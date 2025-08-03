import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface TransactionMonitorProps {
  txHash: string;
  onComplete?: (receipt: ethers.TransactionReceipt) => void;
  onError?: (error: Error) => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const TransactionMonitor: React.FC<TransactionMonitorProps> = ({
  txHash,
  onComplete,
  onError
}) => {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'failed'>('pending');
  const [confirmations, setConfirmations] = useState<number>(0);
  const [gasUsed, setGasUsed] = useState<string>('');
  const [blockNumber, setBlockNumber] = useState<number>(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!txHash) return;

    const monitorTransaction = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('No ethereum provider found');
        }
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Wait for transaction to be mined
        const receipt = await provider.waitForTransaction(txHash, 1, 60000); // 60 second timeout
        
        if (receipt && receipt.status === 1) {
          setStatus('confirmed');
          setConfirmations(1); // Default to 1 confirmation
          setGasUsed(ethers.formatUnits(receipt.gasUsed || 0, 'wei'));
          setBlockNumber(receipt.blockNumber || 0);
          onComplete?.(receipt);
        } else {
          setStatus('failed');
          setError('Transaction failed');
          onError?.(new Error('Transaction failed'));
        }
      } catch (err) {
        setStatus('failed');
        setError((err as Error).message);
        onError?.(err as Error);
      }
    };

    monitorTransaction();
  }, [txHash, onComplete, onError]);

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'confirmed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending': return '⏳';
      case 'confirmed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="transaction-monitor">
      <div className={`status-indicator ${getStatusColor()}`}>
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">
          {status === 'pending' && 'Transaction Pending...'}
          {status === 'confirmed' && 'Transaction Confirmed!'}
          {status === 'failed' && 'Transaction Failed'}
        </span>
      </div>
      
      <div className="transaction-details">
        <div className="tx-hash">
          <strong>Transaction Hash:</strong>
          <a 
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-link"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </div>
        
        {status === 'confirmed' && (
          <>
            <div className="confirmation-details">
              <div><strong>Confirmations:</strong> {confirmations}</div>
              <div><strong>Block Number:</strong> {blockNumber}</div>
              <div><strong>Gas Used:</strong> {gasUsed}</div>
            </div>
          </>
        )}
        
        {status === 'failed' && (
          <div className="error-details">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionMonitor; 