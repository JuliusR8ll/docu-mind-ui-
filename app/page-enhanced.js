'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

// Available backend servers
const BACKEND_SERVERS = {
  original: { url: 'http://localhost:8000', name: 'Original Server', status: 'unknown' },
  improved: { url: 'http://localhost:8000', name: 'Improved Server (Gemini)', status: 'unknown' },
  grok: { url: 'http://localhost:8001', name: 'Grok AI Server', status: 'unknown' }
};

export default function Home() {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPdfProcessed, setIsPdfProcessed] = useState(false);
  const [selectedServer, setSelectedServer] = useState('grok'); // Default to Grok
  const [serverStatus, setServerStatus] = useState(BACKEND_SERVERS);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  // Check server health on component mount and when server selection changes
  useEffect(() => {
    checkServerHealth();
  }, [selectedServer]);

  const checkServerHealth = async () => {
    const newStatus = { ...serverStatus };
    
    for (const [key, server] of Object.entries(BACKEND_SERVERS)) {
      try {
        const response = await axios.get(`${server.url}/health`, { timeout: 3000 });
        newStatus[key] = {
          ...server,
          status: 'online',
          aiProvider: response.data.ai_provider || 'Unknown'
        };
      } catch (error) {
        newStatus[key] = {
          ...server,
          status: 'offline',
          error: error.message
        };
      }
    }
    
    setServerStatus(newStatus);
  };

  const getCurrentServerUrl = () => {
    return serverStatus[selectedServer]?.url || BACKEND_SERVERS[selectedServer].url;
  };

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setIsPdfProcessed(false);
    setAnswer('');
    setDebugInfo(null);
    
    if (selectedFiles.length > 0) {
      setMessage(`${selectedFiles.length} PDF file(s) selected`);
      setMessageType('info');
    } else {
      setMessage('');
      setMessageType('');
    }
  };

  const onFileUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select at least one PDF file');
      setMessageType('error');
      return;
    }

    const currentServer = getCurrentServerUrl();
    setIsProcessing(true);
    setMessage(`Processing PDFs using ${serverStatus[selectedServer].name}...`);
    setMessageType('info');

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('pdf_docs', file);
    });

    try {
      const response = await axios.post(`${currentServer}/process_pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000 // 30 second timeout
      });
      
      const successMsg = `✅ PDFs processed successfully! 
      • Created ${response.data.chunks_created} text chunks
      • Total characters: ${response.data.total_chars}
      • AI Provider: ${response.data.ai_provider || 'Unknown'}`;
      
      setMessage(successMsg);
      setMessageType('success');
      setIsPdfProcessed(true);
      
      // Get debug info
      try {
        const debugResponse = await axios.get(`${currentServer}/debug/text`);
        setDebugInfo(debugResponse.data);
      } catch (debugError) {
        console.warn('Could not fetch debug info:', debugError);
      }
      
    } catch (error) {
      const errorMsg = `❌ PDF processing failed: ${error.response?.data?.error || error.message}`;
      setMessage(errorMsg);
      setMessageType('error');
      setIsPdfProcessed(false);
      
      // If current server failed, suggest alternatives
      if (error.code === 'ECONNREFUSED') {
        const availableServers = Object.entries(serverStatus)
          .filter(([key, server]) => server.status === 'online' && key !== selectedServer)
          .map(([key, server]) => server.name);
        
        if (availableServers.length > 0) {
          setMessage(errorMsg + `\n\n💡 Try switching to: ${availableServers.join(', ')}`);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const onAskQuestion = async () => {
    if (!question.trim()) {
      setMessage('Please enter a question');
      setMessageType('error');
      return;
    }

    const currentServer = getCurrentServerUrl();
    setIsProcessing(true);
    setMessage(`🤖 ${serverStatus[selectedServer].name} is thinking...`);
    setMessageType('info');

    try {
      const response = await axios.post(`${currentServer}/answer_question`, { 
        user_question: question 
      }, {
        timeout: 30000 // 30 second timeout
      });
      
      setAnswer(response.data.answer);
      setMessage(`✅ Answer from ${response.data.ai_provider || serverStatus[selectedServer].name}`);
      setMessageType('success');
      
      // Check if response seems like raw PDF content
      const answerLength = response.data.answer.length;
      const hasRawPdfIndicators = response.data.answer.includes('%20') || 
                                  response.data.answer.includes('  ') && answerLength > 500 ||
                                  response.data.answer.match(/\w{1}\s+\w{1}\s+\w{1}/); // Spaced out characters
      
      if (hasRawPdfIndicators) {
        setMessage('⚠️ Warning: Response seems to contain raw PDF content. Try a different server or check text extraction quality.');
        setMessageType('warning');
      }
      
    } catch (error) {
      const errorMsg = `❌ Failed to get answer: ${error.response?.data?.error || error.message}`;
      setMessage(errorMsg);
      setMessageType('error');
      
      // Suggest server alternatives
      if (error.code === 'ECONNREFUSED') {
        const availableServers = Object.entries(serverStatus)
          .filter(([key, server]) => server.status === 'online' && key !== selectedServer)
          .map(([key, server]) => server.name);
        
        if (availableServers.length > 0) {
          setMessage(errorMsg + `\n\n💡 Try switching to: ${availableServers.join(', ')}`);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isProcessing && isPdfProcessed && question.trim()) {
      onAskQuestion();
    }
  };

  const getServerStatusColor = (status) => {
    switch (status) {
      case 'online': return '#28a745';
      case 'offline': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getServerStatusIcon = (status) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      default: return '🟡';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <span className="brain-icon">🧠</span>
        <h1 className="title">Docu-Mind Enhanced</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '20px' }}>
          Chat with your PDF documents using AI - Enhanced Version
        </p>
      </div>

      {/* Server Selection */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 className="section-title">🔧 Backend Server Selection</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          {Object.entries(serverStatus).map(([key, server]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value={key}
                checked={selectedServer === key}
                onChange={(e) => setSelectedServer(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: getServerStatusColor(server.status) }}>
                {getServerStatusIcon(server.status)} {server.name}
                {server.aiProvider && <small> ({server.aiProvider})</small>}
              </span>
            </label>
          ))}
        </div>
        <button 
          onClick={checkServerHealth}
          style={{ padding: '5px 10px', fontSize: '0.9rem' }}
        >
          🔄 Refresh Server Status
        </button>
        
        <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
          <strong>Selected:</strong> {serverStatus[selectedServer].name} 
          ({getCurrentServerUrl()}) - {serverStatus[selectedServer].status}
        </div>
      </div>

      <div className="card">
        <div className="upload-section">
          <h2 className="section-title">📄 Upload PDF Files</h2>
          <label htmlFor="file-upload" className="upload-button">
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              '📁 Select PDFs'
            )}
          </label>
          <input
            id="file-upload"
            type="file"
            className="file-input"
            onChange={onFileChange}
            multiple
            accept=".pdf"
            disabled={isProcessing}
          />
          <button
            className="process-button"
            onClick={onFileUpload}
            disabled={isProcessing || files.length === 0 || serverStatus[selectedServer].status !== 'online'}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              `🚀 Process PDFs (${serverStatus[selectedServer].name})`
            )}
          </button>
          {files.length > 0 && (
            <div className="file-info">
              Selected files: {files.map(f => f.name).join(', ')}
            </div>
          )}
        </div>

        <div className="question-section">
          <h2 className="section-title">❓ Ask a Question</h2>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isPdfProcessed ? "Enter your question about the PDFs..." : "Please process PDFs first"}
            disabled={!isPdfProcessed || isProcessing}
            className="question-input"
          />
          <button
            className="ask-button"
            onClick={onAskQuestion}
            disabled={!isPdfProcessed || isProcessing || !question.trim() || serverStatus[selectedServer].status !== 'online'}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Thinking...
              </>
            ) : (
              `🔍 Ask (${serverStatus[selectedServer].name})`
            )}
          </button>
        </div>

        {message && (
          <div className={`message ${messageType}`} style={{ whiteSpace: 'pre-line' }}>
            {message}
          </div>
        )}

        {answer && (
          <div className="answer-section">
            <h3 className="answer-title">💡 Answer:</h3>
            <p className="answer-text" style={{ whiteSpace: 'pre-line' }}>{answer}</p>
            
            {/* Answer quality indicator */}
            <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
              <strong>Answer Quality:</strong> {
                answer.length < 100 ? '🟢 Concise' :
                answer.length < 500 ? '🟡 Detailed' :
                '🔴 Very Long (possible raw content)'
              } • Length: {answer.length} characters
            </div>
          </div>
        )}

        {/* Debug Info Section */}
        {debugInfo && (
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              style={{ background: 'none', border: '1px solid #ddd', padding: '5px 10px', cursor: 'pointer' }}
            >
              {showDebugInfo ? '🔼' : '🔽'} Debug Info
            </button>
            
            {showDebugInfo && (
              <div style={{ 
                marginTop: '10px', 
                padding: '15px', 
                background: '#f8f9fa', 
                border: '1px solid #ddd', 
                borderRadius: '5px',
                fontSize: '0.9rem'
              }}>
                <h4>📊 Text Extraction Debug</h4>
                <p><strong>Total Length:</strong> {debugInfo.total_length} characters</p>
                <p><strong>Chunks Created:</strong> {debugInfo.chunks_count}</p>
                <p><strong>AI Provider:</strong> {debugInfo.ai_provider}</p>
                
                <h5>Sample Extracted Text:</h5>
                <div style={{ 
                  background: '#fff', 
                  padding: '10px', 
                  border: '1px solid #ddd', 
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {debugInfo.sample}
                </div>
                
                {debugInfo.chunks_preview && (
                  <>
                    <h5>Chunk Previews:</h5>
                    {debugInfo.chunks_preview.map((chunk, index) => (
                      <div key={index} style={{ 
                        background: '#fff', 
                        padding: '10px', 
                        border: '1px solid #ddd', 
                        marginBottom: '5px',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem'
                      }}>
                        <strong>Chunk {index + 1}:</strong> {chunk}...
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center', background: '#f8f9fa' }}>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>🚀 Enhanced Features:</h3>
        <p style={{ color: '#888', lineHeight: '1.6' }}>
          • Multiple AI backend support (Gemini, Grok AI)<br />
          • Server health monitoring and switching<br />
          • Debug information for troubleshooting<br />
          • Answer quality indicators<br />
          • Enhanced error handling and suggestions
        </p>
      </div>
    </div>
  );
}
