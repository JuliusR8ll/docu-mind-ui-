'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './context/AuthContext'; // NEW: Import useAuth to get user details
import Link from 'next/link'; // NEW: Import Link for redirect messages

const API_BASE_URL = 'http://localhost:8000'; // Groq backend server

export default function Home() {
  const { user, isAuthenticated } = useAuth(); // NEW: Get authenticated user details
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  // REMOVE THESE OLD STATES (no longer asking general questions)
  // const [question, setQuestion] = useState('');
  // const [answer, setAnswer] = useState('');
  // const [lastModel, setLastModel] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  // RENAMED STATE:
  const [isCatalogProcessed, setIsCatalogProcessed] = useState(false); // Renamed from isPdfProcessed

  const [serverStatus, setServerStatus] = useState('checking');
  const [aiProvider, setAiProvider] = useState('');
  const [processingStats, setProcessingStats] = useState(null);
  
  // NEW STATE FOR INTERACTIVE ORDER FLOW - MODIFIED to support multiple items
  const [currentStep, setCurrentStep] = useState('initial'); // 'initial', 'item_selection', 'quantity_selection', 'date_selection', 'time_selection', 'summary', 'order_complete'
  const [cart, setCart] = useState([]); // Array of {itemName, quantity, price, availableQuantity}
  const [currentItem, setCurrentItem] = useState(null); // Currently selected item for quantity input
  const [orderData, setOrderData] = useState({
    deliveryDate: '',
    partOfDay: '',
    deliveryTime: ''
  });
  const [availableItems, setAvailableItems] = useState([]); // List of item names from catalog
  const [fullCatalog, setFullCatalog] = useState([]); // Full structured catalog data
  const [currentInput, setCurrentInput] = useState(''); // Input for current step
  const [inputError, setInputError] = useState(''); // Error message for current input
  const [stepMessage, setStepMessage] = useState(''); // Message specific to the current ordering step
  const [chatHistory, setChatHistory] = useState([]);

  // Check server health on component mount
  useEffect(() => {
    checkServerHealth();
  }, []);

  // NEW EFFECT: To fetch catalog items once documents are processed AND user is authenticated
useEffect(() => {
    checkServerHealth();
  }, []);

  // NEW EFFECT: To fetch catalog items once documents are processed AND user is authenticated
  useEffect(() => {
    if (isCatalogProcessed && isAuthenticated) { // Make sure BOTH conditions are met
      fetchCatalogItems();
    }
    // Also, reset order flow if authentication status changes to not authenticated
    if (!isAuthenticated) {
      resetOrderFlow();
      setIsCatalogProcessed(false);
    }
  }, [isCatalogProcessed, isAuthenticated]);// Dependencies: run when these change


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
    // RENAMED STATE HERE:
    setIsCatalogProcessed(false);
    // REMOVED: setAnswer('');
    setProcessingStats(null);
    // REMOVED: setLastModel('');
    
    // NEW: Reset order flow on new file selection
    resetOrderFlow();
    
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

  // NEW FUNCTION: Resets all order-specific state
  const resetOrderFlow = () => {
    setCurrentStep('initial');
    setCart([]);
    setCurrentItem(null);
    setOrderData({
      deliveryDate: '',
      partOfDay: '',
      deliveryTime: ''
    });
    setAvailableItems([]);
    setFullCatalog([]);
    setCurrentInput('');
    setInputError('');
    setStepMessage('');
    setChatHistory([]);
  };

  const resetAll = () => {
    setFiles([]);
    setMessage('');
    setMessageType('');
    // REMOVED: setQuestion('');
    // REMOVED: setAnswer('');
    // RENAMED STATE HERE:
    setIsCatalogProcessed(false);
    setProcessingStats(null);
    // REMOVED: setLastModel('');
    
    // NEW: Reset order flow when resetting all
    resetOrderFlow();
    
    // Reset file input
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // NEW HELPER FUNCTION: Generates time options based on part of day
const generateTimeOptions = (partOfDay) => {
  const options = [];
  let startHour, endHour;

  switch (partOfDay) {
    case 'Morning':
      startHour = 8;
      endHour = 11; // 8 AM to 11 AM (exclusive of 12 PM)
      break;
    case 'Afternoon':
      startHour = 12;
      endHour = 16; // 12 PM to 4 PM (exclusive of 5 PM)
      break;
    case 'Evening':
      startHour = 17;
      endHour = 20; // 5 PM to 8 PM (exclusive of 9 PM)
      break;
    default:
      return []; // No options if partOfDay is not selected
  }

  for (let h = startHour; h <= endHour; h++) {
    const hourString = String(h).padStart(2, '0'); // e.g., "08"
    options.push(`${hourString}:00`);
  }
  return options;
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
    resetOrderFlow(); // NEW: Ensure flow is reset before new upload

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('documents', file);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/process_documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
        timeout: 120000 // 120 second timeout for document processing
      });
      
      // Store processing statistics
      setProcessingStats({
        files_processed: response.data.files_processed,
        chunks_created: response.data.chunks_created, // This will be 0 for PDFs only, for others it's total_chars/1000
        total_chars: response.data.total_chars,
        timestamp: response.data.timestamp
      });
      
      setMessage(`✅ Documents processed successfully! 
📄 Files: ${response.data.files_processed} | 📝 Characters: ${response.data.total_chars?.toLocaleString() || 0}
📋 Supported formats: ${response.data.supported_formats?.join(', ') || 'PDF, Excel, CSV'}`);
      setMessageType('success');
      // RENAMED STATE HERE:
      setIsCatalogProcessed(true); // Indicate catalog is ready
      // The `useEffect` will now trigger fetchCatalogItems()
    } catch (error) {
      setMessage(`❌ Document processing failed: ${error.response?.data?.error || error.message}`);
      setMessageType('error');
      // RENAMED STATE HERE:
      setIsCatalogProcessed(false);
      resetOrderFlow(); // NEW: Reset order flow on upload failure
    } finally {
      setIsProcessing(false);
    }
  };

  // NEW FUNCTION: Fetch structured catalog items from backend
    // NEW: Fetch structured catalog items from backend
  const fetchCatalogItems = async () => {
    setStepMessage('Fetching catalog items...'); // This message should appear first
    setInputError(''); // Clear any previous errors
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/get_catalog_items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFullCatalog(response.data.items);
      setAvailableItems(response.data.item_names);
      
      if (response.data.item_names && response.data.item_names.length > 0) {
       const initialMessage = `Welcome! I can help you place an order. 😊\nHere are the items we have available today: **${response.data.item_names.join(', ')}**.\n\nWhat would you like to get? (You can add multiple items by typing them one at a time)`;
        
        setChatHistory([{ role: 'assistant', content: initialMessage }]);
        setCurrentStep('item_selection');
        setStepMessage(''); // We use chatHistory for messages now, so this can be cleared
        setInputError('');
      } else {
        setStepMessage('No items could be extracted from the catalog. Please ensure your catalog file has "Item Name", "Price", and "Quantity" columns.');
        setMessageType('warning');
        setIsCatalogProcessed(false);
        resetOrderFlow();
      }
    } catch (error) {
      setStepMessage(`❌ Failed to fetch catalog items: ${error.response?.data?.error || error.message}. Please try processing documents again.`);
      setMessageType('error');
      setIsCatalogProcessed(false);
      resetOrderFlow();
    }
  };
  
  // NEW FUNCTION: Handle user input for each step of the order flow
    // NEW: Replaces handleOrderInput. Manages the chat flow.
    // NEW: Replaces handleOrderInput. Manages the chat flow.
    // Find the handleSendMessage function
  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;

    const userInput = currentInput.trim();
    const newChatHistory = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newChatHistory);
    setCurrentInput('');
    setIsProcessing(true);
    setInputError('');

    // --- LOGICAL VALIDATION for non-fuzzy steps ---
    if (currentStep === 'quantity_selection') {
      const quantity = parseInt(userInput, 10);
      if (isNaN(quantity) || quantity <= 0 || quantity > currentItem.availableQuantity) {
        const quantityError = `Sorry, that's not a valid quantity. We have ${currentItem.availableQuantity} of ${currentItem.itemName} in stock. Please enter a number between 1 and ${currentItem.availableQuantity}.`;
        setChatHistory(prev => [...prev, { role: 'assistant', content: quantityError }]);
        setIsProcessing(false);
        return; // End early, no need for LLM call
      }
      
      // Add item to cart
      const cartItem = {
        itemName: currentItem.itemName,
        quantity: quantity,
        price: currentItem.price,
        availableQuantity: currentItem.availableQuantity
      };
      setCart(prev => {
        const newCart = [...prev, cartItem];
        console.log('Cart after adding item:', newCart); // Debug log
        return newCart;
      });
      
      // Store item name before clearing currentItem
      const addedItemName = currentItem.itemName;
      setCurrentItem(null);
      
      // Ask if they want to add more items or proceed to delivery details
      const continueMessage = `Great! Added ${quantity} x ${addedItemName} to your cart.\n\nWould you like to add another item, or shall we proceed with delivery details? (Type "done" to proceed, or another item name to add more)`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: continueMessage }]);
      setCurrentStep('item_selection'); // Go back to item selection
      setIsProcessing(false);
      return; // End early
    }

    if (currentStep === 'date_selection') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(userInput);
      selectedDate.setHours(0, 0, 0, 0);
      if (isNaN(selectedDate.getTime()) || selectedDate < today) {
        const dateError = "That doesn't seem to be a valid future date. Please enter a date in YYYY-MM-DD format, for today or later.";
        setChatHistory(prev => [...prev, { role: 'assistant', content: dateError }]);
        setIsProcessing(false);
        return; // End early
      }
      setOrderData(prev => ({ ...prev, deliveryDate: userInput, partOfDay: '', deliveryTime: '' }));
      setCurrentStep('time_selection');
      const timePrompt = "Excellent. Now please select a part of the day and a specific time for your delivery.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: timePrompt }]);
      setIsProcessing(false);
      return; // End early
    }
    // End of non-fuzzy validation

    // --- API CALL TO LLM for fuzzy matching and conversational responses ---
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/conversational_order`, {
        chatHistory: newChatHistory,
        currentStep: currentStep,
        availableItems: availableItems,
        userInput: userInput
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The backend now returns a structured object for item_selection
      if (currentStep === 'item_selection') {
        const matchResult = response.data; // e.g., { match: "Classic Burger", response: "..." }
        setChatHistory(prev => [...prev, { role: 'assistant', content: matchResult.response }]);

        if (matchResult.match && matchResult.match !== 'None') {
          // Check if user wants to proceed to delivery details
          if (matchResult.match === 'done') {
            if (cart.length > 0) {
              setCurrentStep('date_selection');
              const datePrompt = "Perfect! And when would you like your order delivered? (Please enter the date in YYYY-MM-DD format)";
              setChatHistory(prev => [...prev, { role: 'assistant', content: datePrompt }]);
            } else {
              const emptyCartMessage = "You haven't added any items to your cart yet. Please select an item first.";
              setChatHistory(prev => [...prev, { role: 'assistant', content: emptyCartMessage }]);
            }
          } else {
            // A valid item was matched by the LLM!
            const matchedItem = fullCatalog.find(item => item.item_name === matchResult.match);
            if (matchedItem) {
              // Check if item already exists in cart
              const existingCartItem = cart.find(item => item.itemName === matchedItem.item_name);
              if (existingCartItem) {
                const alreadyAddedMessage = `You already have ${existingCartItem.quantity} x ${matchedItem.item_name} in your cart. Would you like to add a different item or type "done" to proceed?`;
                setChatHistory(prev => [...prev, { role: 'assistant', content: alreadyAddedMessage }]);
              } else {
                setCurrentItem({
                  itemName: matchedItem.item_name,
                  price: matchedItem.price,
                  availableQuantity: matchedItem.available_quantity
                });
                setCurrentStep('quantity_selection'); // Move to the next step
              }
            }
          }
        }
        // If match is 'None', we do nothing, the user stays on item_selection step
      } else {
        // For other steps, the response is simpler
        const assistantMessage = response.data.response;
        setChatHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      }

    } catch (error) {
      console.error('LLM response error:', error);
      const errorMessage = "I'm having a little trouble thinking right now. Could you try again?";
      setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setIsProcessing(false);
    }
  };
  // REMOVED onAskQuestion function (no longer used)

  const handleKeyPress = (e) => {
    // We now have a single function to handle sending messages
    if (e.key === 'Enter' && !isProcessing && serverStatus === 'online') {
      if (currentStep === 'summary') {
        // If user presses Enter on summary, assume they want to submit
        submitOrder();
      } else {
        handleSendMessage();
      }
    }
  };

    // NEW FUNCTION: Submit the order to backend
  const submitOrder = async () => {
    setIsProcessing(true);
    // Use setChatHistory for user feedback in a chat interface
    setChatHistory(prev => [...prev, { role: 'assistant', content: 'Submitting your order...' }]);

    try {
      // Submit multiple orders (one for each cart item) 
      const token = localStorage.getItem('token');
      const orderPromises = cart.map(async (item) => {
        return axios.post(`${API_BASE_URL}/submit_order`, {
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price, // This is price per item
          deliveryDate: orderData.deliveryDate,
          partOfDay: orderData.partOfDay,
          deliveryTime: orderData.deliveryTime,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });
      
      const responses = await Promise.all(orderPromises);
      
      // Calculate total price across all orders
      const totalPrice = responses.reduce((sum, response) => {
        return sum + response.data.order.total_price;
      }, 0);
      
      const orderIds = responses.map(response => response.data.order.order_id);
      
      const successMessage = `✅ Orders submitted successfully!\nOrder IDs: ${orderIds.join(', ')}\n\nYour total price is $${totalPrice.toFixed(2)}. Thank you for your order, ${user?.username}!`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: successMessage }]);
      setCurrentStep('order_complete'); // Indicate completion

    } catch (error) {
      const errorMessage = `❌ Failed to submit order: ${error.response?.data?.error || error.message}`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
      // Keep the user on the summary step so they can try again
      setCurrentStep('summary');
    } finally {
      setIsProcessing(false);
    }
  };

    // NEW FUNCTION: Handles the confirmation of the selected time from dropdowns
  const handleTimeConfirmation = async () => {
    // Basic validation to ensure both dropdowns are selected
    if (!orderData.partOfDay || !orderData.deliveryTime) {
      const timeError = "Please select both a part of the day and a specific time.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: timeError }]);
      return;
    }

    setIsProcessing(true);
    // Add user's "action" to chat history for context
    const userActionMessage = `(Selected time: ${orderData.partOfDay} - ${orderData.deliveryTime})`;
    setChatHistory(prev => [...prev, { role: 'user', content: userActionMessage }]);

    // Validation for future time
    const [hourStr, minuteStr] = orderData.deliveryTime.split(':');
    const deliveryDateObj = new Date(orderData.deliveryDate);
    deliveryDateObj.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0);
    const nowPlusOneHour = new Date(new Date().getTime() + 60 * 60 * 1000);
    const isTodayDelivery = (deliveryDateObj.toDateString() === new Date().toDateString());

    if (isTodayDelivery && deliveryDateObj < nowPlusOneHour) {
      const timeError = `For today's delivery, please select a time at least 1 hour from now.`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: timeError }]);
      setIsProcessing(false);
      return;
    }

    // If validation passes, move to summary
    setCurrentStep('summary');
    
    // Create summary of all cart items
    const itemsSummary = cart.map(item => 
      `• ${item.itemName} x${item.quantity} = $${(item.quantity * item.price).toFixed(2)}`
    ).join('\n');
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    const summaryMessage = `Great! Here is your order summary:\n\n**Customer:** ${user?.username} (${user?.phone_number})\n\n**Items:**\n${itemsSummary}\n\n**Total Price:** $${totalPrice.toFixed(2)}\n**Delivery:** ${orderData.deliveryDate} during the ${orderData.partOfDay} around ${orderData.deliveryTime}\n\nShall I confirm and place this order for you?`;
    setChatHistory(prev => [...prev, { role: 'assistant', content: summaryMessage }]);
    setIsProcessing(false);
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

  // NEW: Conditional rendering for the main content based on authentication
  if (!isAuthenticated) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2 style={{ color: '#555' }}>Please log in to use Docu-Mind.</h2>
        <p style={{ color: '#777', marginTop: '15px' }}>
          You will be redirected automatically, or click <Link href="/login" style={{ color: '#667eea', textDecoration: 'none' }}>here to log in</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <span className="brain-icon">🧠</span>
        <h1 className="title">Docu-Mind</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '10px' }}>
          Interactive Order System for Restaurants
        </p>
        <p style={{ color: '#888', fontSize: '0.95rem', marginBottom: '20px' }}>
          Upload Restaurant Catalog • Select Items • Place Orders
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
          <h2 className="section-title">📄 Upload Restaurant Catalog</h2>
          <div style={{ marginBottom: '15px', fontSize: '0.9rem', color: '#666' }}>
            <strong>Supported formats:</strong> Excel (.xlsx, .xls), CSV (Recommended for structured data)
            <br/>
            (PDF can be uploaded for general text, but structured ordering works best with Excel/CSV)
          </div>
          <label htmlFor="file-upload" className="upload-button">
            {isProcessing ? (
              <>
                <span className="loading"></span>
                Processing...
              </>
            ) : (
              '📁 Select Catalog File(s)'
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
              '🚀 Process Catalog'
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
          
          {(isCatalogProcessed || processingStats || currentStep !== 'initial') && ( // Condition for reset button
            <button
              className="reset-button"
              onClick={resetAll}
              disabled={isProcessing}
              style={{ marginTop: '15px' }}
            >
              🔄 Start New Order / Clear Catalog
            </button>
          )}
        </div>

        {/* NEW: Order Placement Section - REPLACES OLD QUESTION SECTION */}
                {/* NEW CHAT UI SECTION */}
        <div className="question-section chat-container">
          <h2 className="section-title">🛒 Place Your Order</h2>
          {isCatalogProcessed ? (
            <>
              {/* Cart Display */}
              {cart.length > 0 && (
                <div className="cart-display" style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  marginBottom: '15px',
                  border: '1px solid #e9ecef'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#495057', fontSize: '0.9rem' }}>🛒 Current Cart:</h4>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    {cart.map((item, index) => (
                      <div key={index} style={{ marginBottom: '4px' }}>
                        • {item.itemName} x{item.quantity} = ${(item.quantity * item.price).toFixed(2)}
                      </div>
                    ))}
                    <div style={{ marginTop: '8px', fontWeight: 'bold', borderTop: '1px solid #dee2e6', paddingTop: '4px' }}>
                      Total: ${cart.reduce((sum, item) => sum + (item.quantity * item.price), 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              <div className="chat-history">
                {chatHistory.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.role}`}>
                    {/* A simple way to render markdown-like bold text */}
                    {msg.content.split('**').map((part, i) =>
                      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                    )}
                  </div>
                ))}
                {isProcessing && (
                  <div className="chat-message assistant">
                    <span className="typing-indicator"></span>
                  </div>
                )}
              </div>

              {/* --- CORRECTED INPUT AREA --- */}
              {/* This entire area appears at the bottom of the chat */}
              {currentStep !== 'order_complete' && ( // Don't show input area if order is complete
                <div className="chat-input-area">
                  {currentStep === 'time_selection' && (
                    <div className="time-selectors">
                      <select
                        value={orderData.partOfDay}
                        onChange={(e) => setOrderData(prev => ({ ...prev, partOfDay: e.target.value, deliveryTime: '' }))}
                        className="chat-select"
                      >
                        <option value="">-- Part of Day --</option>
                        <option value="Morning">Morning (8 AM - 12 PM)</option>
                        <option value="Afternoon">Afternoon (12 PM - 5 PM)</option>
                        <option value="Evening">Evening (5 PM - 9 PM)</option>
                      </select>
                      <select
                        value={orderData.deliveryTime}
                        onChange={(e) => setOrderData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                        className="chat-select"
                        disabled={!orderData.partOfDay}
                      >
                        <option value="">-- Time --</option>
                        {generateTimeOptions(orderData.partOfDay).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <button className="send-button" onClick={handleTimeConfirmation} disabled={isProcessing}>
                        Confirm
                      </button>
                    </div>
                  )}

                  {['item_selection', 'quantity_selection', 'date_selection'].includes(currentStep) && (
                    <>
                      <input
                        type={
                          currentStep === 'quantity_selection' ? 'number' :
                          currentStep === 'date_selection' ? 'date' : 'text'
                        }
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={
                          currentStep === 'item_selection' ? (cart.length > 0 ? 'Add another item or type "done"...' : 'Type an item name...') :
                          currentStep === 'quantity_selection' ? 'Enter quantity...' : ''
                        }
                        disabled={isProcessing || serverStatus !== 'online'}
                        className="chat-input"
                      />
                      <button
                        className="send-button"
                        onClick={handleSendMessage}
                        disabled={isProcessing || serverStatus !== 'online'}
                      >
                        Send
                      </button>
                    </>
                  )}

                  {currentStep === 'summary' && (
                    <div className="summary-actions">
                      <button className="confirm-order-button" onClick={submitOrder} disabled={isProcessing}>
                        ✔️ Yes, Place Order
                      </button>
                      <button className="reset-button" style={{margin: '0 0 0 10px'}} onClick={resetAll} disabled={isProcessing}>
                        ❌ No, Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#888' }}>Please process a restaurant catalog first to start placing an order.</p>
          )}
        </div>
        {/* Existing general message display */}
        {message && currentStep !== 'order_complete' && ( // Only show if not handled by order_complete
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
                <div className="stat-value">{processingStats.chunks_created}</div> {/* This was chunks_created, but now might be ~chars/1000 */}
                <div className="stat-label">Characters</div> {/* Label change */}
              </div>
               <div className="stat-item"> {/* NEW: Total Chars */}
                <div className="stat-value">{processingStats.total_chars?.toLocaleString()}</div>
                <div className="stat-label">Total Chars</div>
              </div>
               <div className="stat-item"> {/* NEW: Catalog Items Count */}
                <div className="stat-value">{fullCatalog.length}</div>
                <div className="stat-label">Catalog Items</div>
              </div>
            </div>
          </div>
        )}

        {/* REMOVED: Old answer section (no longer applicable for ordering) */}
        {/*
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
        */}
      </div>

      <div className="card" style={{ textAlign: 'center', background: '#f8f9fa' }}>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>How it works:</h3>
        <p style={{ color: '#888', lineHeight: 1.6 }}>
          1. Upload your restaurant catalog (Excel/CSV recommended for structured data).<br />
          2. Click "Process Catalog" to analyze the menu and stock.<br />
          3. Follow the prompts to select items, quantities, and delivery details.<br />
          4. Confirm and place your order!
        </p>
        <div className="capabilities-grid">
          <div className="capability-item">
            <span className="capability-icon">📊</span>
            <div className="capability-title">Excel/CSV Catalogs</div>
            <div className="capability-desc">Extract item names, prices, and available quantities directly.</div>
          </div>
          <div className="capability-item">
            <span className="capability-icon">🛒</span>
            <div className="capability-title">Interactive Ordering</div>
            <div className="capability-desc">Guided step-by-step process for order placement with validation.</div>
          </div>
          <div className="capability-item">
            <span className="capability-icon">💾</span>
            <div className="capability-title">Order Storage</div>
            <div className="capability-desc">Your order details (with user info) are saved on the server.</div>
          </div>
        </div>
      </div>
    </div>
  );
}