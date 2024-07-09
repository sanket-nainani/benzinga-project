'use client';

import React, { useState, useEffect } from 'react';
import { getItem } from './service/storageService';

// Define types for stock, portfolio item, and transaction
type Stock = {
  symbol: string;
  price: number;
  name: string;
};

type PortfolioItem = {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentValue: number;
};

type Transaction = {
  type: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price: number;
  totalCost: number;
  totalGain: number;
  timestamp: Date;
};

const App: React.FC = () => {
  const [walletBalance, setWalletBalance] = useState<number>(100000); // Starting with $100,000
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stocksList, setStocksList] = useState<Stock[]>([]);

  useEffect(() => {
    const currentPortfolio: PortfolioItem[] = JSON.parse(getItem('portfolio')) || [];
    const currentTransactions: Transaction[] = JSON.parse(getItem('transactions')) || [];
    setPortfolio(currentPortfolio)
    setTransactions(currentTransactions)
    const symbols: any[] = [];
    currentPortfolio?.forEach((element: PortfolioItem) => {
      symbols.push(element.symbol)
    });
    fetch(`https://api.benzinga.com/api/v1/quoteDelayed?token=0beae1e20cfd42c3b17b65e2a54c9d7f&symbols=${symbols}`)
      .then(response => response.json())
      .then((data: any) => {
        console.log(data.quotes);
        const stockList: React.SetStateAction<Stock[]> = [];
        data.quotes?.forEach((element: any) => {
          stockList.push({symbol: element.security.symbol, price: element.quote.last})
        });
        setStocksList(stockList);
        currentPortfolio.map((stock: any) => {
          const index = stockList.findIndex((element) => element.symbol == stock.symbol);
          stock.currentValue = stockList[index].price
        })
      });
  }, []);

  // Function to handle buying stocks
  const buyStock = (stock: Stock, quantity: number): void => {
    // Calculate total cost based on current price fetched from the API
    const totalCost: number = stock.price * quantity;

    // Check if user has enough balance
    if (totalCost > walletBalance) {
      alert('Insufficient balance to buy this stock!');
      return;
    }

    // Update wallet balance
    setWalletBalance(prevBalance => prevBalance - totalCost);

    // Update portfolio
    const existingStock = portfolio.find(item => item.symbol === stock.symbol);
    if (existingStock) {
      // If stock already exists in portfolio, update quantity and average cost
      setPortfolio((prevPortfolio: any) => {
        prevPortfolio.map((item: any) =>
          item.symbol === stock.symbol
            ? { ...item, quantity: item.quantity + quantity, avgCost: (item.avgCost * item.quantity + totalCost) / (item.quantity + quantity) }
            : item
        )
        localStorage.setItem('portfolio', JSON.stringify(prevPortfolio));
        return prevPortfolio;
        }
      );
    } else {
      // Add new stock to portfolio
      setPortfolio(prevPortfolio => [...prevPortfolio, { symbol: stock.symbol, quantity, avgCost: totalCost }]);
    }

    // Update transactions
    setTransactions((prevTransactions: any) => {
      const newTransactions = [
        ...prevTransactions,
        { type: 'buy', symbol: stock.symbol, quantity, price: stock.price, totalCost, totalGain: 0, timestamp: new Date() }
      ]
      localStorage.setItem('transactions', JSON.stringify(newTransactions));
      return newTransactions;
    });

    // Update local storage
    localStorage.setItem('walletBalance', String(walletBalance - totalCost));
  };

  // Function to handle selling stocks
  const sellStock = (stock: PortfolioItem, quantity: number): void => {
    // Update portfolio and transactions
    const sellPrice: number = stocksList.find(item => item.symbol === stock.symbol)?.price || 0;
    const totalGain: number = sellPrice * quantity;
    const totalCost: number = sellPrice * quantity;

    setPortfolio(prevPortfolio => {
      const updatedPortfolio = prevPortfolio.map(item =>
        item.symbol === stock.symbol
          ? { ...item, quantity: item.quantity - quantity }
          : item
      );
      return updatedPortfolio.filter(item => item.quantity > 0);
    });

    // Update wallet balance
    setWalletBalance(prevBalance => prevBalance + totalGain);

    // // Update transactions
    // setTransactions(prevTransactions => [
    //   ...prevTransactions,
    //   { type: 'sell', symbol: stock.symbol, quantity, price: sellPrice, totalCost: 0, totalGain, timestamp: new Date() }
    // ]);

    // Update transactions
    setTransactions((prevTransactions: any) => {
      const newTransactions = [
        ...prevTransactions,
        { type: 'sell', symbol: stock.symbol, quantity, price: sellPrice, totalCost, totalGain, timestamp: new Date() }
      ]
      localStorage.setItem('transactions', JSON.stringify(newTransactions));
      return newTransactions;
    });

    // Update local storage
    localStorage.setItem('walletBalance', String(walletBalance + totalGain));
    localStorage.setItem('portfolio', JSON.stringify(portfolio));
    // localStorage.setItem('transactions', JSON.stringify(transactions));
  };

  // Calculate total portfolio value
  const calculatePortfolioValue = (): number => {
    return portfolio.reduce((totalValue, stock) => {
      const currentStock = stocksList.find(item => item.symbol === stock.symbol);
      if (currentStock) {
        return totalValue + (currentStock.price * stock.quantity);
      }
      return totalValue;
    }, 0);
  };

  // Calculate overall profit/loss
  const calculateProfitLoss = (): number => {
    const portfolioValue: number = calculatePortfolioValue();
    return portfolioValue + walletBalance - 100000; // Starting balance is $100,000
  };

  return (
    <div className="app">
      <h1>Stock Market Trader</h1>
      <div className="container">
        <div className="wallet">
          <h2>Wallet Balance: ${walletBalance}</h2>
          <h2>Portfolio Value: ${calculatePortfolioValue()}</h2>
          <h2>Profit/Loss: ${calculateProfitLoss()}</h2>
        </div>
        <StockList onBuy={buyStock} />
        <Portfolio portfolio={portfolio} onSell={sellStock} />
        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  );
};

type StockListProps = {
  onBuy: (stock: Stock, quantity: number) => void;
};

const StockList: React.FC<StockListProps> = ({ onBuy }) => {
  const [symbol, setSymbol] = useState<string>(""); // Starting with $100,000
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [buyQty, setBuyQty] = useState<number>(1);

  function setStockSymbol(event: { target: { value: string; }; }) {
    setSymbol(event.target.value);
  }

  function setBuyQtyShare(event: { target: { value: number; }; }) {
    setBuyQty(event.target.value);
  }

  // Fetch stock data from API (example using a mock API endpoint)
  useEffect(() => {
    if(symbol!='') {fetch(`https://api.benzinga.com/api/v1/quoteDelayed?token=0beae1e20cfd42c3b17b65e2a54c9d7f&symbols=${symbol}`)
      .then(response => response.json())
      .then((data: any) => {
        console.log(data.quotes);
        const stockList: React.SetStateAction<Stock[]> = [];
        data.quotes?.forEach((element: any) => {
          stockList.push({symbol: element.security.symbol, price: element.quote.last, name: element.security.name})
        });
        setStocks(stockList)});}
  }, [symbol]);
  
  return (
    <div className="stock-list">
      <h2>Stock Search</h2>
      <input
          value={symbol}
          type="text"
          className="input"
          placeholder="Stock Symbol"
          onChange={setStockSymbol}
          name="symbol"
        />
      {stocks && stocks.length? <table>
       <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {stocks?.map(stock => (
            <tr key={stock.symbol}>
              <td>{stock.symbol}</td>
              <td>{stock.name}</td>
              <td>{stock.price}</td>
              <td>
                <input
                  value={buyQty}
                  type="number"
                  className="input"
                  placeholder="Buy Qty"
                  onChange={setBuyQtyShare}
                  name="buyQty"
                />
                <span>{stock.price*buyQty}</span>
                <button className="primaryButton" onClick={() =>{ onBuy(stock, buyQty);setBuyQty(1);}}>Buy</button>  
              </td>
            </tr>
          ))}
        </tbody>
      </table> : null}
    </div>
  );
};

type PortfolioProps = {
  portfolio: PortfolioItem[];
  onSell: (stock: PortfolioItem, quantity: number) => void;
};

const Portfolio: React.FC<PortfolioProps> = ({ portfolio, onSell }) => {
  const [sellQty, setSellQty] = useState<number>(1);

  function setSetQtyShare(event: { target: { value: number; }; }) {
    setSellQty(event.target.value);
  }

  return (
    <div className="portfolio">
      <h2>Portfolio</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>Purchase Price</th>
            <th>Purchase Total</th>
            <th>Current Price</th>
            <th>Current Total</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map(stock => (
            <tr key={stock.symbol}>
              <td>{stock.symbol}</td>
              <td> {stock.quantity}</td>
              <td>{stock.avgCost/stock.quantity}</td>
              <td>  {stock.avgCost}</td>
              <td>{stock.currentValue}</td>
              <td>  {stock.quantity * stock.currentValue}</td>
              <td>
                <input
                  value={sellQty}
                  type="number"
                  className="input"
                  placeholder="Sell Qty"
                  onChange={setSetQtyShare}
                  name="sellQty"
                />
                <button onClick={() => onSell(stock, sellQty)}>Sell</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type TransactionHistoryProps = {
  transactions: Transaction[];
};

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  return (
    <div className="transaction-history">
      <h2>Transaction History</h2>
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={index}>
              <td className={`${transaction.type === 'buy' ? 'blue':'red'}`}> {transaction.type === 'buy' ? 'Bought ' : 'Sold '}</td>
              <td> {transaction.symbol} </td>
              <td> {transaction.quantity} </td>
              <td> {transaction.price} </td>
              <td> {transaction.type === 'buy' ? transaction.totalCost.toFixed(2) : transaction.totalGain} </td>
              <td> {transaction.timestamp.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
    </div>
  );
};

type ModalProps = {
  type: string;
};

const Modal: React.FC<ModalProps> = ({ type }) => {
  switch (type) {
    case 'buy':
      return (
        <div className="transaction-history">
          <h2>Transaction History</h2>
        </div>
      );
    }
};

export default App;
