"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAccessToken,
  usePrivy,
  useWallets,
  useLogin,
  useSessionSigners,
} from "@privy-io/react-auth";
import {
  Send,
  User,
  Wallet,
  Menu,
  X,
  DollarSign,
  ArrowUpRight,
  Copy,
  LogOut,
  RefreshCw,
} from "lucide-react";

interface Message {
  id: string;
  content: string | JSX.Element;
  isUser: boolean;
  timestamp: Date;
  transactionHash?: string;
}

interface Balance {
  symbol: string;
  amount: string;
  value: string;
  contractAddress?: string;
}

export default function Home() {
  const { authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { addSessionSigners } = useSessionSigners();

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  // Chat and transaction state
  const [isSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Balance state
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [totalValue, setTotalValue] = useState(0);

  const SEI_TESTNET_CONFIG = {
    chainId: 1328,
    rpcUrl: "https://evm-rpc-testnet.sei-apis.com",
    explorerUrl: "https://seitrace.com/",
    nativeSymbol: "SEI",
    tokens: [
      // {
      //   symbol: 'SBC',
      //   contractAddress: ''
      // },
    ],
  };

  // Fetch native sei balance
  const fetchNativeBalance = async (address: string): Promise<string> => {
    try {
      const response = await fetch(SEI_TESTNET_CONFIG.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      const balanceWei = BigInt(data.result);
      const balanceSei = Number(balanceWei) / Math.pow(10, 18);
      return balanceSei.toFixed(6);
    } catch (error) {
      console.error("Error fetching native balance:", error);
      return "0.000000";
    }
  };

  // Fetch ERC-20 token balance
  const fetchTokenBalance = async (
    address: string,
    tokenContract: string,
    decimals: number = 18,
  ): Promise<string> => {
    try {
      const balanceOfSelector = "0x70a08231";
      const paddedAddress = address.slice(2).padStart(64, "0");
      const data = balanceOfSelector + paddedAddress;

      const response = await fetch(SEI_TESTNET_CONFIG.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: tokenContract,
              data: data,
            },
            "latest",
          ],
          id: 1,
        }),
      });

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message);
      }

      const balanceWei = BigInt(result.result || "0x0");
      const balance = Number(balanceWei) / Math.pow(10, decimals);
      return balance.toFixed(6);
    } catch (error) {
      console.error("Error fetching token balance:", error);
      return "0.000000";
    }
  };

  // Fetch token price from CoinGecko
  const fetchTokenPrice = async (symbol: string): Promise<number> => {
    try {
      const coinIdMap: { [key: string]: string } = {
        SEI: "sei-network",
        // SBC: "sei-network",
      };

      const coinId = coinIdMap[symbol];
      if (!coinId) return 0;

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      );
      const data = await response.json();

      // if (symbol === "SBC") return data[coinId]?.usd / 100;

      return data[coinId]?.usd || 0;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return 0;
    }
  };

  async function fetchTokensFromBackend() {
    try {
      const response = await fetch("/api/tokens"); // your backend endpoint
      if (!response.ok) throw new Error("Failed to fetch tokens");
      return await response.json(); // expects array like [{ symbol, contractAddress }]
    } catch (err) {
      console.error("Error fetching tokens from backend:", err);
      return [];
    }
  }

  // Fetch all balances
  const fetchBalances = async () => {
    if (!wallets[0]?.address) return;

    setIsLoadingBalances(true);
    setError(null);

    try {
      const address = wallets[0].address;
      const newBalances: Balance[] = [];

      const seiBalance = await fetchNativeBalance(address);
      const seiPrice = await fetchTokenPrice("SEI");
      const seiValue = parseFloat(seiBalance) * seiPrice;

      newBalances.push({
        symbol: "SEI",
        amount: seiBalance,
        value: `$${seiValue.toFixed(2)}`,
      });

      const tokens = await fetchTokensFromBackend();
      console.log("tokens ", tokens.data);

      for (const token of tokens.data) {
        try {
          const tokenBalance = await fetchTokenBalance(address, token.address);
          const tokenPrice = token.priceInSei * seiPrice;
          const tokenValue = parseFloat(tokenBalance) * tokenPrice;

          if (parseFloat(tokenBalance) > 0) {
            newBalances.push({
              symbol: token.symbol,
              amount: tokenBalance,
              value: `$${tokenValue.toFixed(2)}`,
              contractAddress: token.address,
            });
          }
        } catch (error) {
          console.error(`Error fetching ${token.symbol} balance:`, error);
        }
      }

      setBalances(newBalances);
      const total = newBalances.reduce((sum, balance) => {
        return (
          sum + parseFloat(balance.value.replace("$", "").replace(",", ""))
        );
      }, 0);
      setTotalValue(total);
    } catch (error) {
      console.error("Error fetching balances:", error);
      setError("Failed to fetch balances. Please try again.");
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Refresh balances
  const refreshBalances = () => {
    fetchBalances();
  };

  // Configure login with session signers
  const { login } = useLogin({
    onComplete: async ({ user, isNewUser }) => {
      try {
        // Check if this specific wallet has session signers
        const hasSessionSigners = user?.wallet?.delegated === true;
        if (isNewUser || !hasSessionSigners) {
          await addSessionSigners({
            address: user.wallet?.address || "",
            signers: [
              {
                signerId: process.env.NEXT_PUBLIC_SESSION_SIGNER_ID!,
                policyIds: [],
              },
            ],
          });
        }

        addBotMessage(
          "Welcome to SeiBot! I can help you send funds, check balances, and more. Try typing 'Send 0.1 SEI to @username' or 'Show balance' to get started.",
        );
      } catch (error) {
        console.error("Failed to add session signers:", error);
        setError("Failed to setup session signers: " + error);
      }
    },
  });

  // Fetch balances when wallet is connected
  useEffect(() => {
    if (authenticated && wallets[0]?.address) {
      fetchBalances();
    }
  }, [authenticated, wallets]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addBotMessage = (content: string | any, transactionHash?: string) => {
    let formattedContent: string | JSX.Element = content;

    const botMessage: Message = {
      id: Date.now().toString() + "-bot",
      content: formattedContent,
      isUser: false,
      timestamp: new Date(),
      transactionHash,
    };
    setMessages((prev) => [...prev, botMessage]);
  };

  const addUserMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString() + "-user",
      content,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
  };

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const userMsg = inputMessage.trim();
    addUserMessage(userMsg);
    setInputMessage("");
    setIsLoading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("No access token available");
      }

      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMsg,
          authToken: accessToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Server error");
      }

      // Handle different intents based on the response
      switch (data.intent) {
        case "crypto.send":
          if (data.result?.hash) {
            const recipient = data.result.recipient || "unknown";
            const tokenSymbol = data.result.tokenSymbol || "SEI";
            const amount = data.result.amount || "";

            addBotMessage(
              <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">✅</span>
                  <p className="text-lg font-semibold text-green-700">
                    Transaction Sent Successfully!
                  </p>
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Amount:</span> {amount}{" "}
                    {tokenSymbol}
                  </p>
                  <p>
                    <span className="font-medium">Recipient:</span> {recipient}
                  </p>
                  <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded break-all">
                    TX Hash: {data.result.hash}
                  </p>
                </div>
              </div>,
              data.result.hash,
            );
            setTimeout(fetchBalances, 3000);
          }
          break;

        case "crypto.launchToken":
          if (data.result?.tokenAddress && data.result?.swapAddress) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🚀</span>
                  <p className="text-lg font-semibold text-yellow-700">
                    Token Launched Successfully!
                  </p>
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {data.result.name}
                  </p>
                  <p>
                    <span className="font-medium">Symbol:</span>{" "}
                    {data.result.symbol}
                  </p>
                  <p>
                    <span className="font-medium">Supply:</span>{" "}
                    {Number(data.result.supply).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Price:</span>{" "}
                    {data.result.price}
                  </p>
                  <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded break-all">
                    Token Address: {data.result.tokenAddress}
                  </p>
                  <p className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded break-all">
                    Swap Address: {data.result.swapAddress}
                  </p>
                </div>
              </div>,
              data.result.tokenAddress,
            );
          }
          break;

        case "crypto.buy":
          if (data.result?.hash) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">✅</span>
                  <p className="text-lg font-semibold text-green-700">
                    Buy Successful
                  </p>
                </div>
                <p className="text-sm text-gray-700">
                  Bought <b>{data.result.tokenSymbol}</b> with{" "}
                  <b>{data.result.seiAmount}</b> SEI
                </p>
                <a
                  href={`${SEI_TESTNET_CONFIG.explorerUrl}/tx/${data.result.hash}?chain=atlantic-2`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                >
                  View Transaction
                </a>
              </div>,
            );
          }
          break;

        case "crypto.sell":
          if (data.result?.hash) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">💸</span>
                  <p className="text-lg font-semibold text-red-700">
                    Sell Successful
                  </p>
                </div>
                <p className="text-sm text-gray-700">
                  Sold <b>{data.result.tokenAmount}</b>{" "}
                  <b>{data.result.tokenSymbol}</b> for SEI
                </p>
                <a
                  href={`${SEI_TESTNET_CONFIG.explorerUrl}/tx/${data.result.hash}?chain=atlantic-2`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                >
                  View Transaction
                </a>
              </div>,
            );
          }
          break;

        case "crypto.price":
          if (data.result?.data) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📈</span>
                  <p className="text-lg font-semibold text-blue-700">
                    Token Price
                  </p>
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Amount:</span>{" "}
                    {data.result.data.tokenAmount}{" "}
                    {data.result.data.tokenSymbol}
                  </p>
                  <p>
                    <span className="font-medium">Price:</span>{" "}
                    {data.result.data.priceInSEI} SEI
                  </p>
                </div>
              </div>,
            );
          }
          break;

        case "wallet.balance":
          if (data.result?.balances) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">💰</span>
                  <p className="text-lg font-semibold text-gray-700">
                    Your Wallet Balance
                  </p>
                </div>
                <div className="space-y-2">
                  {Object.entries(data.result.balances).map(
                    ([token, balance]) => (
                      <div
                        key={token}
                        className="flex justify-between items-center py-1 px-3 bg-white rounded border"
                      >
                        <span className="font-medium text-gray-800">
                          {token}
                        </span>
                        <span className="text-gray-600">
                          {Number(balance).toFixed(4)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <p className="text-xs text-gray-500 break-all">
                  Address: {data.result.address}
                </p>
              </div>,
            );
          }
          break;

        case "wallet.address":
          if (data.result?.address) {
            addBotMessage(
              <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🏠</span>
                  <p className="text-lg font-semibold text-gray-700">
                    Your Wallet Address
                  </p>
                </div>
                <div className="bg-white p-3 rounded border font-mono text-sm break-all">
                  {data.result.address}
                </div>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(data.result.address)
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  📋 Copy to clipboard
                </button>
              </div>,
            );
          }
          break;

        case "transaction.history":
          addBotMessage(
            <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <p className="text-lg font-semibold text-gray-700">
                  Transaction History
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {data.result?.message || "Transaction history requested"}
              </p>
              {data.result?.explorerUrl && (
                <a
                  href={data.result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  🔗 View on Sei Explorer
                </a>
              )}
              {data.result?.note && (
                <p className="text-xs text-gray-500 italic">
                  {data.result.note}
                </p>
              )}
            </div>,
          );
          break;

        case "general.help":
          addBotMessage(
            <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🤖</span>
                <p className="text-lg font-semibold text-blue-700">
                  How can I help you?
                </p>
              </div>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-line text-sm text-gray-700">
                  {data.result?.message || "Here are the available commands..."}
                </div>
              </div>
              {data.result?.commands && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {data.result.commands.map((cmd: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              )}
            </div>,
          );
          break;

        case "general.greetings":
          addBotMessage(
            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">👋</span>
                <p className="text-lg font-semibold text-blue-700">Welcome!</p>
              </div>
              <p className="text-gray-700">
                {data.result?.message || "Hello! How can I assist you today?"}
              </p>
              {data.result?.suggestion && (
                <p className="text-sm text-blue-600 italic">
                  {data.result.suggestion}
                </p>
              )}
            </div>,
          );
          break;

        default:
          // Handle error cases or unknown intents
          if (data.result?.message) {
            addBotMessage(
              <div className="space-y-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  {/* <span className="text-2xl">❌</span> */}
                  {/* <p className="text-lg font-semibold text-red-600">Error</p> */}
                </div>
                <p className="text-gray-700">{data.result.message}</p>
              </div>,
            );
          } else if (data.result?.error) {
            addBotMessage(
              <div className="space-y-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">❌</span>
                  <p className="text-lg font-semibold text-red-600">Error</p>
                </div>
                <p className="text-gray-700">{data.result.error}</p>
              </div>,
            );
          } else {
            // Fallback for any unhandled responses
            addBotMessage(
              <div className="space-y-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-700">
                  {data.result?.message || typeof data.result === "string"
                    ? data.result
                    : JSON.stringify(data.result, null, 2)}
                </p>
              </div>,
            );
          }
          break;
      }

      setError(null); // Clear any previous errors
    } catch (err: any) {
      addBotMessage(
        <div className="space-y-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">⚠️</span>
            <p className="text-lg font-semibold text-red-600">
              Connection Error
            </p>
          </div>
          <p className="text-gray-700">{err.message}</p>
        </div>,
      );
      setError(null); // Clear the error state since we're showing it in chat
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md text-center border border-white/20">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SeiBot
            </h1>
            <p className="text-gray-300 text-lg">
              Your AI-powered transaction companion on Sei testnet
            </p>
          </div>
          <button
            onClick={() => login({ loginMethods: ["twitter"] })}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-xl transform hover:scale-105"
          >
            Connect with X
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex overflow-hidden">
      <div
        className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-xl overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Portfolio</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-white/50 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">
                  @{user?.twitter?.username || "User"}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-600 font-mono">
                    {wallets[0]?.address
                      ? `${wallets[0].address.slice(0, 6)}...${wallets[0].address.slice(-4)}`
                      : "No wallet"}
                  </p>
                  {wallets[0]?.address && (
                    <button
                      onClick={() => copyToClipboard(wallets[0]?.address || "")}
                      className="p-1 hover:bg-white/50 rounded transition-colors"
                    >
                      <Copy className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">Sei Testnet</p>
              </div>
            </div>
          </div>
          <div className="p-6 border-b border-gray-200/50">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <p className="text-sm text-gray-600">Total Portfolio Value</p>
                <button
                  onClick={refreshBalances}
                  disabled={isLoadingBalances}
                  className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-gray-500 ${isLoadingBalances ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {isLoadingBalances ? "..." : `$${totalValue.toLocaleString()}`}
              </p>
              <p className="text-sm text-green-600 font-medium">Sei Testnet</p>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Assets
            </h3>
            <div className="space-y-4">
              {isLoadingBalances ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading balances...</p>
                </div>
              ) : balances.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No assets found</p>
                  <button
                    onClick={refreshBalances}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Refresh balances
                  </button>
                </div>
              ) : (
                balances.map((balance, index) => (
                  <div
                    key={index}
                    className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/30 hover:bg-white/80 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">
                          {balance.symbol}
                        </p>
                        <p className="text-sm text-gray-600">
                          {balance.amount}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          {balance.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="p-4 border-t border-gray-200/50">
            <div className="flex space-x-2">
              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center space-x-2 p-3 rounded-xl bg-red-100/50 hover:bg-red-200/50 transition-colors text-red-600"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl hover:bg-gray-100/50 transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-800">SeiBot</h1>
              <p className="text-sm text-gray-600">
                Sei Testnet • Ready to help with your transactions
              </p>
            </div>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg animate-pulse"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <Wallet className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                Welcome to SeiBot
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                I can help you send crypto, swap tokens and manage your
                portfolio on Sei testnet. Just type naturally!
              </p>
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-1 max-w-md mx-auto shadow-xl">
                <div className="bg-white rounded-xl p-4">
                  <p className="text-gray-800 font-mono text-sm">
                    Send 0.1 SEI to @alice
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md px-6 py-4 rounded-2xl shadow-lg ${
                  message.isUser
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                    : "bg-white/80 backdrop-blur-sm border border-gray-200/30 text-gray-800"
                } break-words`}
              >
                {typeof message.content === "string" ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  message.content
                )}
                {message.transactionHash && (
                  <div className="mt-4 pt-4 border-t border-gray-200/30">
                    <a
                      href={`${SEI_TESTNET_CONFIG.explorerUrl}/tx/${message.transactionHash}?chain=atlantic-2`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      View Transaction <ArrowUpRight className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                )}
                <p className="text-xs opacity-70 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/80 backdrop-blur-sm border border-gray-200/30 rounded-2xl px-6 py-4 shadow-lg">
                <div className="flex space-x-2 items-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-gray-600 text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 p-6">
          <div className="flex space-x-4 max-w-4xl">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Type your message... (e.g., Send 0.1 SEI to @alice)"
              className="flex-1 px-6 py-4 border border-gray-300/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent bg-white/50 backdrop-blur-sm shadow-sm text-gray-800 placeholder-gray-500"
              disabled={isSending}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!inputMessage.trim() || isSending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center shadow-lg transform hover:scale-105 disabled:transform-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
