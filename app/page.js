'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Groq backend server

export default function Home() {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPdfProcessed, setIsPdfProcessed] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [aiProvider, setAiProvider] = useState('');
  const [processingStats, setProcessingStats] = useState(null);
  const [lastModel, setLastModel] = useState('');

  // Check server health on component mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      setServerStatus('online');
      setAiProvider(response.data.ai_provider || 'Groq');
    } catch (error) {
      setServerStatus('offline');
      setAiProvider('');
      console.error('Server health check failed:', error);
    }
  };


  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setIsPdfProcessed(false);
    setAnswer('');
    setProcessingStats(null);
    setLastModel('');
    
    if (selectedFiles.length > 0) {
      const fileTypes = selectedFiles.map(f => {
        if (f.name.endsWith('.pdf')) return 'PDF';
        if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) return 'Excel';
        if (f.name.endsWith('.csv')) return 'CSV';
        return 'Unknown';
      });
      const uniqueTypes = [...new Set(fileTypes)];
      setMessage(`${selectedFiles.length} file(s) selected (${uniqueTypes.join(', ')})`);
      setMessageType('info');
    } else {
      setMessage('');
      setMessageType('');
    }
  };

  const resetAll = () => {
    setFiles([]);
    setMessage('');
    setMessageType('');
    setQuestion('');
    setAnswer('');
    setIsPdfProcessed(false);
    setProcessingStats(null);
    setLastModel('');
    
    // Reset file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const onFileUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select at least one file (PDF, Excel, or CSV)');
      setMessageType('error');
      return;
    }

    // Validate file types
    const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
    const invalidFiles = files.filter(file => 
      !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
    );
    
    if (invalidFiles.length > 0) {
      setMessage(`Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}. Only PDF, Excel (.xlsx, .xls), and CSV files are supported.`);
      setMessageType('error');
      return;
    }

    setIsProcessing(true);
    setMessage('Processing documents...');
    setMessageType('info');

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('documents', file);
    });

    try {
      const response = await axios.post(`${API_BASE_URL}/process_documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000 // 120 second timeout for document processing
      });
      
      // Store processing statistics
      setProcessingStats({
        files_processed: response.data.files_processed,
        chunks_created: response.data.chunks_created,
        total_chars: response.data.total_chars,
        timestamp: response.data.timestamp
      });
      
      setMessage(`✅ Documents processed successfully! 
📄 Files: ${response.data.files_processed} | 📊 Chunks: ${response.data.chunks_created} | 📝 Characters: ${response.data.total_chars?.toLocaleString() || 0}
📋 Supported formats: ${response.data.supported_formats?.join(', ') || 'PDF, Excel, CSV'}`);
      setMessageType('success');
      setIsPdfProcessed(true);
    } catch (error) {
      setMessage(`❌ Document processing failed: ${error.response?.data?.error || error.message}`);
      setMessageType('error');
      setIsPdfProcessed(false);
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

    if (!isPdfProcessed) {
      setMessage('Please process documents first before asking questions.');
      setMessageType('error');
      return;
    }

    setIsProcessing(true);
    setMessage('Fetching answer...');
    setMessageType('info');

    try {
      const response = await axios.post(`${API_BASE_URL}/answer_question`, { 
        user_question: question 
      });
      
      setAnswer(response.data.answer);
      setLastModel(response.data.model);
      
      // Check if spell corrections were made
      if (response.data.spell_check) {
        setMessage(`✅ Answer from ${response.data.model} (${response.data.ai_provider})\n\n🔧 Typo corrections applied:\nOriginal: "${response.data.spell_check.original_question}"\nCorrected: "${response.data.spell_check.corrected_question}"\nChanges: ${response.data.spell_check.corrections_applied.join(', ')}`);
      } else {
        setMessage(`✅ Answer from ${response.data.model} (${response.data.ai_provider})`);
      }
      
      setMessageType('success');
    } catch (error) {
      setMessage(`❌ Failed to get answer: ${error.response?.data?.error || error.message}`);
      setMessageType('error');
    } finally {
      setIsProcessing(false);
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isProcessing && question.trim() && serverStatus === 'online') {
      onAskQuestion();
    }
  };

  const getServerStatusColor = () => {
    switch (serverStatus) {
      case 'online': return '#28a745';
      case 'offline': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getServerStatusIcon = () => {
    switch (serverStatus) {
      case 'online': return '🟢';
      case 'offline': return '🔴';
      default: return '🟡';
    }
  };

  return (
    <div className="container">
      <div className="header">
        <span className="brain-icon">🧠</span>
        <h1 className="title">Docu-Mind</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '10px' }}>
          Chat with your documents using Groq AI
        </p>
        <p style={{ color: '#888', fontSize: '0.95rem', marginBottom: '20px' }}>
          Upload PDFs, Excel, CSV • Extract Knowledge • Ask Questions • Get Intelligent Answers
        </p>
      </div>

      {/* Server Status */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 className="section-title">🔧 Server Status</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ color: getServerStatusColor() }}>
            {getServerStatusIcon()} Groq Backend Server
            {aiProvider && <small> ({aiProvider})</small>}
          </span>
        </div>
        <button 
          onClick={checkServerHealth}
          style={{ padding: '5px 10px', fontSize: '0.9rem' }}
        >
          🔄 Check Server Status
        </button>
        
        <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
          <strong>Server:</strong> {API_BASE_URL} - {serverStatus}
        </div>
      </div>

      <div className="card">
        <div className="upload-section">
          <h2 className="section-title">📄 Upload Documents</h2>
          <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: '#666' }}>
            <strong>Supported formats:</strong> PDF, Excel (.xlsx, .xls), CSV
          </div>
          <label htmlFor="file-upload" className="upload-button">
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              '📁 Select Documents'
            )}
          </label>
          <input
            id="file-upload"
            type="file"
            className="file-input"
            onChange={onFileChange}
            multiple
            accept=".pdf,.xlsx,.xls,.csv"
            disabled={isProcessing}
          />
          <button
            className="process-button"
            onClick={onFileUpload}
            disabled={isProcessing || files.length === 0}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              '🚀 Process Documents'
            )}
          </button>
          {files.length > 0 && (
            <div className="file-info">
              <strong>Selected files:</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                {files.map((file, index) => {
                  let icon = '📄';
                  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) icon = '📊';
                  if (file.name.endsWith('.csv')) icon = '📈';
                  if (file.name.endsWith('.pdf')) icon = '📕';
                  
                  return (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {icon} {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
          {(isPdfProcessed || processingStats || answer) && (
            <button
              className="reset-button"
              onClick={resetAll}
              disabled={isProcessing}
              style={{ marginTop: '15px' }}
            >
              🔄 Start Fresh
            </button>
          )}
        </div>

        <div className="question-section">
          <h2 className="section-title">❓ Ask a Question</h2>
          {isPdfProcessed && (
            <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#666' }}>
              <strong>Try asking:</strong> "What is the main topic?", "Summarize the key points", "What are the conclusions?", "Show me the data trends", "Calculate totals from the spreadsheet"
            </div>
          )}
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isPdfProcessed ? "Enter your question about your documents..." : "Please process documents first"}
            disabled={isProcessing || serverStatus !== 'online'}
            className="question-input"
          />
          <button
            className="ask-button"
            onClick={onAskQuestion}
            disabled={!isPdfProcessed || isProcessing || !question.trim()}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Thinking...
              </>
            ) : (
              `🔍 Ask ${aiProvider ? `(${aiProvider})` : ''}`
            )}
          </button>
        </div>

        {message && (
          <div className={`message ${messageType}`} style={{ whiteSpace: 'pre-line' }}>
            {message}
          </div>
        )}

        {/* Processing Statistics */}
        {processingStats && (
          <div className="stats-section">
            <h3 style={{ color: '#555', marginBottom: '15px', fontSize: '1.1rem' }}>📊 Processing Statistics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              <div className="stat-item">
                <div className="stat-value">{processingStats.files_processed}</div>
                <div className="stat-label">Files Processed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{processingStats.chunks_created}</div>
                <div className="stat-label">Text Chunks</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{processingStats.total_chars?.toLocaleString()}</div>
                <div className="stat-label">Characters</div>
              </div>
            </div>
          </div>
        )}

        {answer && (
          <div className="answer-section">
            <h3 className="answer-title">💡 Answer:</h3>
            <p className="answer-text" style={{ whiteSpace: 'pre-line' }}>{answer}</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', fontSize: '0.9rem', color: '#666' }}>
              <div>
                <strong>Response Length:</strong> {answer.length} characters
              </div>
              {lastModel && (
                <div>
                  <strong>Model:</strong> {lastModel}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center', background: '#f8f9fa' }}>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>How it works:</h3>
        <p style={{ color: '#888', lineHeight: '1.6' }}>
          1. Upload your documents (PDF, Excel, CSV)<br />
          2. Click "Process Documents" to analyze them<br />
          3. Ask questions about the content or data<br />
          4. Get AI-powered answers and analysis based on your documents
        </p>
        <div className="capabilities-grid">
          <div className="capability-item">
            <span className="capability-icon">📕</span>
            <div className="capability-title">PDF Documents</div>
            <div className="capability-desc">Text extraction, content analysis, and document understanding</div>
          </div>
          <div className="capability-item">
            <span className="capability-icon">📊</span>
            <div className="capability-title">Excel Spreadsheets</div>
            <div className="capability-desc">Data analysis, calculations, trend identification, and insights</div>
          </div>
          <div className="capability-item">
            <span className="capability-icon">📈</span>
            <div className="capability-title">CSV Data Files</div>
            <div className="capability-desc">Data processing, statistical analysis, and pattern recognition</div>
          </div>
        </div>
      </div>
    </div>
  );
}
