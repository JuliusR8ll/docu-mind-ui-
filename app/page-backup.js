'use client';

import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000'; // Change this to your backend URL

export default function Home() {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPdfProcessed, setIsPdfProcessed] = useState(false);

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setIsPdfProcessed(false);
    setAnswer('');
    
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

    setIsProcessing(true);
    setMessage('Processing PDFs...');
    setMessageType('info');

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('pdf_docs', file);
    });

    try {
      const response = await axios.post(`${API_BASE_URL}/process_pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage(`PDFs processed successfully! Created ${response.data.chunks_created} text chunks.`);
      setMessageType('success');
      setIsPdfProcessed(true);
    } catch (error) {
      setMessage(`PDF processing failed: ${error.response?.data?.error || error.message}`);
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

    setIsProcessing(true);
    setMessage('Fetching answer...');
    setMessageType('info');

    try {
      const response = await axios.post(`${API_BASE_URL}/answer_question`, { 
        user_question: question 
      });
      
      setAnswer(response.data.answer);
      setMessage('');
      setMessageType('');
    } catch (error) {
      setMessage(`Failed to get answer: ${error.response?.data?.error || error.message}`);
      setMessageType('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isProcessing && isPdfProcessed && question.trim()) {
      onAskQuestion();
    }
  };

  return (
    <div className="container">
      <div className="header">
        <span className="brain-icon">🧠</span>
        <h1 className="title">Docu-Mind</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '20px' }}>
          Chat with your PDF documents using AI
        </p>
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
            disabled={isProcessing || files.length === 0}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              '🚀 Process PDFs'
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
            disabled={!isPdfProcessed || isProcessing || !question.trim()}
          >
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Thinking...
              </>
            ) : (
              '🔍 Ask'
            )}
          </button>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        {answer && (
          <div className="answer-section">
            <h3 className="answer-title">💡 Answer:</h3>
            <p className="answer-text">{answer}</p>
          </div>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center', background: '#f8f9fa' }}>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>How it works:</h3>
        <p style={{ color: '#888', lineHeight: '1.6' }}>
          1. Upload your PDF documents<br />
          2. Click "Process PDFs" to analyze them<br />
          3. Ask questions about the content<br />
          4. Get AI-powered answers based on your documents
        </p>
      </div>
    </div>
  );
}
