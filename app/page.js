'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import Link from 'next/link';

const API_BASE_URL = 'http://localhost:8000';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCatalogProcessed, setIsCatalogProcessed] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  const [aiProvider, setAiProvider] = useState('');
  const [processingStats, setProcessingStats] = useState(null);
  const [currentStep, setCurrentStep] = useState('initial');
  const [cart, setCart] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  // Add this new state variable
const [itemPendingRemoval, setItemPendingRemoval] = useState(null);
  // Add this new state variable
const [bookingDayOfWeek, setBookingDayOfWeek] = useState('');
  const [orderData, setOrderData] = useState({
    deliveryDate: '',
    partOfDay: '',
    deliveryTime: ''
  });
  const [availableItems, setAvailableItems] = useState([]);
  const [fullCatalog, setFullCatalog] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [stepMessage, setStepMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [messageCount, setMessageCount] = useState(0);
  const MESSAGE_LIMIT = 30;

  useEffect(() => {
    checkServerHealth();
    if (isAuthenticated) {
      fetchCatalogItems();
    }
  }, [isAuthenticated]);

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

  const fetchCatalogItems = async () => {
    setStepMessage('Fetching catalog items...');
    setInputError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/catalog`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFullCatalog(response.data.items);
      setAvailableItems(response.data.items.map(item => item.item_name));
      
      if (response.data.items && response.data.items.length > 0) {
       const initialMessage = `Welcome! I can help you place an order. 😊\nHere are the items we have available today: **${response.data.items.map(item => item.item_name).join(', ')}**.\n\nWhat would you like to get? (You can add multiple items by typing them one at a time)`;
        
        setChatHistory([{ role: 'assistant', content: initialMessage }]);
        setCurrentStep('item_selection');
        setStepMessage('');
        setInputError('');
        setIsCatalogProcessed(true);
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

  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setIsCatalogProcessed(false);
    setProcessingStats(null);
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
    setMessageCount(0);
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
    setIsCatalogProcessed(false);
    setProcessingStats(null);
    resetOrderFlow();
    
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const generateTimeOptions = (partOfDay) => {
    const options = [];
    let startHour, endHour;

    switch (partOfDay) {
      case 'Morning':
        startHour = 8;
        endHour = 11;
        break;
      case 'Afternoon':
        startHour = 12;
        endHour = 16;
        break;
      case 'Evening':
        startHour = 17;
        endHour = 20;
        break;
      default:
        return [];
    }

    for (let h = startHour; h <= endHour; h++) {
      const hourString = String(h).padStart(2, '0');
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
    resetOrderFlow();

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
        timeout: 120000
      });
      
      setProcessingStats({
        files_processed: response.data.files_processed,
        chunks_created: response.data.chunks_created,
        total_chars: response.data.total_chars,
        timestamp: response.data.timestamp
      });
      
      setMessage(`✅ Documents processed successfully! \n📄 Files: ${response.data.files_processed} | 📝 Characters: ${response.data.total_chars?.toLocaleString() || 0}
📋 Supported formats: ${response.data.supported_formats?.join(', ') || 'PDF, Excel, CSV'}`);
      setMessageType('success');
      setIsCatalogProcessed(true);
    } catch (error) {
      setMessage(`❌ Document processing failed: ${error.response?.data?.error || error.message}`);
      setMessageType('error');
      setIsCatalogProcessed(false);
      resetOrderFlow();
    } finally {
      setIsProcessing(false);
    }
  };
  
    const handleSendMessage = async () => {
    // --- NEW: Add this block at the very top of the function ---
    if (messageCount >= MESSAGE_LIMIT) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: "You have reached the message limit for this session. Please click 'Start New Order' to begin again." }]);
      setCurrentStep('order_complete'); // Use a final step to disable the input
      return; // Stop the function immediately
    }
    // --- End of new block ---

    if (!currentInput.trim()) return;

    // Increment the counter right after a valid message is sent
    setMessageCount(prevCount => prevCount + 1); // NEW: Increment the counter

    const userInput = currentInput.trim();
    const newChatHistory = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newChatHistory);
    setCurrentInput('');
    setIsProcessing(true);
    setInputError('');

    if (currentStep === 'delivery_confirmation') {
    const affirmative = /^(yes|yeah|yep|yup|confirm|correct|that's right|ok|sounds good)/i;
    const negative = /^(no|nope|wait|change|wrong|not right)/i;

    if (affirmative.test(userInput)) {
      // --- USER CONFIRMED ---
      // Move to the final summary step
      setCurrentStep('summary');

      // Build and display the full order summary
      const itemsSummary = cart.map(item =>
        `• ${item.itemName} x${item.quantity} = $${(item.quantity * item.price).toFixed(2)}`
      ).join('\n');
      const totalPrice = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const summaryMessage = `Great! Here is your order summary:\n\n**Customer:** ${user?.username} (${user?.phone_number})\n\n**Items:**\n${itemsSummary}\n\n**Total Price:** $${totalPrice.toFixed(2)}\n**Delivery:** ${orderData.deliveryDate} at ${orderData.deliveryTime}\n\nShall I confirm and place this order for you?`;
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: summaryMessage }]);
      
    } else if (negative.test(userInput)) {
      // --- USER WANTS TO CHANGE ---
      // Reset delivery data and go back to the date selection step
      setOrderData({ deliveryDate: '', partOfDay: '', deliveryTime: '' });
      setBookingDayOfWeek('');
      setCurrentStep('date_selection');

      const restartMessage = "No problem at all. Let's start over with the delivery details. When would you like to schedule your delivery? (Please enter a date)";
      setChatHistory(prev => [...prev, { role: 'assistant', content: restartMessage }]);

    } else {
      // --- USER'S RESPONSE WAS UNCLEAR ---
      const unclearMessage = "Sorry, I didn't understand. Please respond with 'yes' to confirm the delivery details or 'no' to change them.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: unclearMessage }]);
    }
    
    setIsProcessing(false);
    return; // Stop the function here
  }

   if (currentStep === 'confirm_remove_item') {
    const affirmative = /^(yes|yep|confirm|correct)/i;
    if (affirmative.test(userInput)) {
      handleRemoveItem(itemPendingRemoval); // This calls the function for the UI button
      const successMessage = `Okay, I've removed ${itemPendingRemoval} from your cart. Anything else you need?`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: successMessage }]);
    } else {
      const cancelMessage = "Okay, cancelled that request. The item is still in your cart.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: cancelMessage }]);
    }
    setItemPendingRemoval(null); // Clear the pending item
    setCurrentStep('item_selection'); // Go back to the main ordering step
    setIsProcessing(false);
    return;
  }

  // ===================================================================
  // NEW LOGIC FOR "CONFIRM CLEAR CART"
  // ===================================================================
  if (currentStep === 'confirm_clear_cart') {
    const affirmative = /^(yes|yep|confirm|correct)/i;
    if (affirmative.test(userInput)) {
      setCart([]); // Empty the cart
      const successMessage = "Your cart has been cleared. Let's start over. What would you like to order?";
      setChatHistory(prev => [...prev, { role: 'assistant', content: successMessage }]);
    } else {
      const cancelMessage = "Okay, cancelled. Your cart remains as it was.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: cancelMessage }]);
    }
    setCurrentStep('item_selection'); // Go back to the main ordering step
    setIsProcessing(false);
    return;
  }

    if (currentStep === 'quantity_selection') {
      const quantity = parseInt(userInput, 10);
      if (isNaN(quantity) || quantity <= 0 || quantity > currentItem.availableQuantity) {
        const quantityError = `Sorry, that's not a valid quantity. We have ${currentItem.availableQuantity} of ${currentItem.itemName} in stock. Please enter a number between 1 and ${currentItem.availableQuantity}.`;
        setChatHistory(prev => [...prev, { role: 'assistant', content: quantityError }]);
        setIsProcessing(false);
        return;
      }
      
      const cartItem = {
        itemName: currentItem.itemName,
        quantity: quantity,
        price: currentItem.price,
        availableQuantity: currentItem.availableQuantity
      };
      setCart(prev => {
        const newCart = [...prev, cartItem];
        return newCart;
      });
      
      const addedItemName = currentItem.itemName;
      setCurrentItem(null);
      
      const continueMessage = `Great! Added ${quantity} x ${addedItemName} to your cart.\n\nWould you like to add another item, or shall we proceed with delivery details? (Type \"done\" to proceed, or another item name to add more)`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: continueMessage }]);
      setCurrentStep('item_selection');
      setIsProcessing(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/conversational_order`, {
        chatHistory: newChatHistory,
        currentStep: currentStep,
        availableItems: availableItems,
        userInput: userInput,
        cart: cart
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // ... inside the try { } block of handleSendMessage

if (currentStep === 'item_selection') {
    const response = await axios.post(`${API_BASE_URL}/conversational_order`, {
        chatHistory,
        currentStep: 'item_selection',
        availableItems,
        userInput,
        cart
    }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

    const actionResult = response.data;

    switch (actionResult.action) {
        case 'add_item':
            const matchedItem = fullCatalog.find(item => item.item_name === actionResult.item_name);
            if (matchedItem) {
                if (cart.find(item => item.itemName === matchedItem.item_name)) {
                    // Item is already in the cart. Ask if they want to modify it.
                    const alreadyExistsMsg = `You already have ${actionResult.item_name} in your cart. Did you want to change the quantity?`;
                    setChatHistory(prev => [...prev, { role: 'assistant', content: alreadyExistsMsg }]);
                } else {
                    // New item. Ask for quantity.
                    const askQuantityMsg = `${actionResult.item_name}, great choice! How many would you like?`;
                    setChatHistory(prev => [...prev, { role: 'assistant', content: askQuantityMsg }]);
                    setCurrentItem({ itemName: matchedItem.item_name, price: matchedItem.price, availableQuantity: matchedItem.available_quantity });
                    setCurrentStep('quantity_selection');
                }
            } else {
                 // AI hallucinated an item that doesn't exist.
                const noMatchMsg = `Sorry, I couldn't find "${actionResult.item_name}" on our menu.`;
                setChatHistory(prev => [...prev, { role: 'assistant', content: noMatchMsg }]);
            }
            break;

        case 'modify_item':
            const itemToUpdate = fullCatalog.find(i => i.item_name === actionResult.item_name);
            if (itemToUpdate && actionResult.quantity > 0) {
                if (actionResult.quantity > itemToUpdate.available_quantity) {
                    const quantityErrorMsg = `Sorry, we only have ${itemToUpdate.available_quantity} of that in stock.`;
                    setChatHistory(prev => [...prev, { role: 'assistant', content: quantityErrorMsg }]);
                } else {
                    updateCartItemQuantity(actionResult.item_name, actionResult.quantity);
                    const successMsg = `Okay, I've updated your cart to ${actionResult.quantity} x ${actionResult.item_name}. Anything else?`;
                    setChatHistory(prev => [...prev, { role: 'assistant', content: successMsg }]);
                }
            } else {
                // AI failed to parse correctly.
                const modifyErrorMsg = "I'm not sure which item you wanted to change or what the new quantity is. Could you be more specific? (e.g., '3 classic burgers')";
                setChatHistory(prev => [...prev, { role: 'assistant', content: modifyErrorMsg }]);
            }
            break;

        case 'remove_item':
            // Ask for confirmation to remove.
            const confirmRemoveMsg = `You want to remove ${actionResult.item_name} from your cart. Is that correct? (Type 'yes' or 'no')`;
            setChatHistory(prev => [...prev, { role: 'assistant', content: confirmRemoveMsg }]);
            setItemPendingRemoval(actionResult.item_name);
            setCurrentStep('confirm_remove_item');
            break;
            
        case 'clear_cart':
            // Ask for confirmation to clear.
            const confirmClearMsg = "Are you sure you want to remove all items from your cart? (Type 'yes' or 'no')";
            setChatHistory(prev => [...prev, { role: 'assistant', content: confirmClearMsg }]);
            setCurrentStep('confirm_clear_cart');
            break;

        case 'proceed_to_checkout':
            if (cart.length > 0) {
                const datePrompt = "Perfect! And when would you like this delivered?";
                setChatHistory(prev => [...prev, { role: 'assistant', content: datePrompt }]);
                setCurrentStep('date_selection');
            } else {
                const emptyCartMsg = "Your cart is empty. Please add an item first.";
                setChatHistory(prev => [...prev, { role: 'assistant', content: emptyCartMsg }]);
            }
            break;
            
        case 'no_match':
        default:
            const noMatchMsg = `Sorry, I couldn't find that on our menu. We have items like ${availableItems.slice(0, 3).join(', ')}.`;
            setChatHistory(prev => [...prev, { role: 'assistant', content: noMatchMsg }]);
            break;
    }
}
// ... the rest of the try block continues here

      else {
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isProcessing && serverStatus === 'online') {
      if (currentStep === 'summary') {
        submitOrder();
      } else {
        handleSendMessage();
      }
    }
  };

    const submitOrder = async () => {
    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: 'assistant', content: 'Submitting your order...' }]);
    setCurrentStep('summary'); // Lock the UI

    try {
      const token = localStorage.getItem('token');
      // NEW PAYLOAD: Create a single object with the cart and delivery details
      const payload = {
        cart: cart, // The entire cart array
        deliveryDate: orderData.deliveryDate,
        partOfDay: orderData.partOfDay,
        deliveryTime: orderData.deliveryTime,
      };

      // SINGLE API CALL: Send the payload in one request
      const response = await axios.post(`${API_BASE_URL}/submit_order`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const successMessage = `✅ Order submitted successfully!\nOrder ID: ${response.data.order.order_id}\n\nYour total price is $${response.data.order.total_price.toFixed(2)}. Thank you for your order, ${user?.username}!`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: successMessage }]);
      setCurrentStep('order_complete');
      setCart([]); // Clear cart after successful order

    } catch (error) {
      const errorMessage = `❌ Failed to submit order: ${error.response?.data?.error || error.message}`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
      // Revert to a step where the user can try again, e.g., the time selection
      setCurrentStep('time_selection'); 
    } finally {
      setIsProcessing(false);
    }
  };

  // Add this new function inside your Home component

// REPLACE your old handleTimeValidation function with this one

const handleTimeValidation = async (selectedTime) => {
  if (!selectedTime) return;

  setIsProcessing(true);

  console.log("VALIDATING TIME for day:", bookingDayOfWeek); 

  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_BASE_URL}/validate_delivery_time`, {
      time: selectedTime,
      dayOfWeek: bookingDayOfWeek
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const validationResult = response.data;

    if (validationResult.isValid) {
      // --- THE TIME IS VALID ---
      // 1. Update the state with the selected time
      setOrderData(prev => ({ ...prev, deliveryTime: selectedTime }));

      // 2. MOVE TO THE NEW "delivery_confirmation" STEP
      setCurrentStep('delivery_confirmation');

      // 3. ASK THE USER FOR FINAL CONFIRMATION
      const confirmationPrompt = `Perfect. Just to confirm, you'd like your delivery on **${orderData.deliveryDate}** at **${selectedTime}**. Is that correct? (Type 'yes' or 'no')`;
      
      // We add the user's "action" message for context, then the bot's question
      setChatHistory(prev => [...prev, { role: 'user', content: `(Selected time: ${selectedTime})` }, { role: 'assistant', content: confirmationPrompt }]);
      
    } else {
      // --- THE TIME IS INVALID (This part remains the same) ---
      setChatHistory(prev => [...prev, { role: 'user', content: `(Selected time: ${selectedTime})` }, { role: 'assistant', content: validationResult.message }]);
    }

  } catch (error) {
    const errorMessage = "Sorry, I couldn't check that time. Please try again.";
    setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
  } finally {
    setIsProcessing(false);
  }
};

  const handleIncreaseQuantity = (itemName) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.itemName === itemName && item.quantity < item.availableQuantity) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      });
    });
  };

  const handleDecreaseQuantity = (itemName) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.itemName === itemName && item.quantity > 1) {
          return { ...item, quantity: item.quantity - 1 };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

const handleRemoveItem = (itemName) => {
  setCart(prevCart => prevCart.filter(item => item.itemName !== itemName));
};

    const updateCartItemQuantity = (itemName, newQuantity) => {
    const itemDetails = fullCatalog.find(i => i.item_name === itemName);
    if (!itemDetails) return; // Item not found

    setCart(prevCart => {
      // Use your "remove and re-add" logic
      const otherItems = prevCart.filter(item => item.itemName !== itemName);
      
      if (newQuantity > 0 && newQuantity <= itemDetails.available_quantity) {
        const updatedItem = { ...itemDetails, itemName: itemDetails.item_name, quantity: newQuantity };
        return [...otherItems, updatedItem]; // Add the updated item back
      } else {
        // If new quantity is 0 or invalid, just return the other items (effectively removing it)
        return otherItems;
      }
    });
  };

  // Add this new function inside your Home component

const handleDateValidation = async (selectedDate) => {
  // If no date is selected, do nothing.
  if (!selectedDate) return;

  setIsProcessing(true);
  setInputError(''); // Clear previous errors

  // Add a user message to show what's happening
  const newChatHistory = [...chatHistory, { role: 'user', content: `(Checking availability for date: ${selectedDate})` }];
  setChatHistory(newChatHistory);
  
  try {
    const token = localStorage.getItem('token');
    // Call the NEW backend endpoint
    const response = await axios.post(`${API_BASE_URL}/validate_delivery_date`, {
      date: selectedDate
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const validationResult = response.data;

    if (validationResult.isValid) {
      // --- THE DATE IS VALID ---
      // 1. Update the order state with the valid date
      setOrderData(prev => ({ ...prev, deliveryDate: selectedDate, partOfDay: '', deliveryTime: '' }));
      
      setBookingDayOfWeek(validationResult.dayOfWeek);

      // 2. Move to the next step
      setCurrentStep('time_selection');
      
      // 3. Give the user a confirmation and the next instruction
      const timePrompt = `Great, ${selectedDate} is available! Now please select a part of the day and a specific time for your delivery.`;
      setChatHistory(prev => [...prev, { role: 'assistant', content: timePrompt }]);

      setCurrentInput('');

    } else {
      // --- THE DATE IS INVALID ---
      // 1. Show the specific error message from the backend
      const dateError = validationResult.message;
      setChatHistory(prev => [...prev, { role: 'assistant', content: dateError }]);
      
      // 2. DO NOT change the step. The user remains on 'date_selection' to try again.
      // Optional: Clear the invalid date from the input field
      setCurrentInput('');
    }

  } catch (error) {
    const errorMessage = "Sorry, I couldn't check that date. Please ensure the server is running and try again.";
    setChatHistory(prev => [...prev, { role: 'assistant', content: errorMessage }]);
  } finally {
    setIsProcessing(false);
  }
};

  const cancelOrder = () => {
    const cancelMessage = "Your order has been cancelled. You can continue adding items to your cart.";
    setChatHistory(prev => [...prev, { role: 'assistant', content: cancelMessage }]);
    setCurrentStep('item_selection');
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
            <div className="file-info" style={{ marginTop: '15px' }}>
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
          
          {(isCatalogProcessed || processingStats || currentStep !== 'initial') && (
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

        <div className="question-section chat-container">
          <h2 className="section-title">🛒 Place Your Order</h2>
          {isCatalogProcessed ? (
            <>
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
                      <div key={index} style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>• {item.itemName}</span>
                        <div>
                          <button onClick={() => handleDecreaseQuantity(item.itemName)}>-</button>
                          <span style={{ margin: '0 5px' }}>{item.quantity}</span>
                          <button onClick={() => handleIncreaseQuantity(item.itemName)}>+</button>
                          <button onClick={() => handleRemoveItem(item.itemName)} style={{ marginLeft: '10px' }}>Remove</button>
                        </div>
                        <span>${(item.quantity * item.price).toFixed(2)}</span>
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
                    {typeof msg.content === 'string' && msg.content.split('**').map((part, i) =>
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

              {currentStep !== 'order_complete' && (
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
                              className="chat-select"
                              disabled={!orderData.partOfDay}
                              // This is the most important change: onChange now triggers the validation automatically!
                              onChange={(e) => {
                                // We still update the state visually, but then immediately validate.
                                setOrderData(prev => ({ ...prev, deliveryTime: e.target.value }));
                                handleTimeValidation(e.target.value);
                              }}
                            >
                              <option value="">-- Time --</option>
                              {generateTimeOptions(orderData.partOfDay).map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                        
                          </div>
                        )}

                        {['item_selection', 'quantity_selection', 'delivery_confirmation', 'confirm_remove_item', 'confirm_clear_cart'].includes(currentStep) && (
                          <>
                            {/* This input is for the item, quantity, AND NEW confirmation steps */}
                            <input
                              type={currentStep === 'quantity_selection' ? 'number' : 'text'}
                              value={currentInput}
                              onChange={(e) => setCurrentInput(e.target.value)}
                              onKeyPress={handleKeyPress}
                              placeholder={
                                // Add a new placeholder for the confirmation step
                                currentStep === 'delivery_confirmation' ? "Type 'yes' or 'no'..." :
                                currentStep === 'confirm_remove_item' ? "Type 'yes' to confirm removal..." :
                                currentStep === 'confirm_clear_cart' ? "Type 'yes' to clear cart..." :
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

                  {/* --- THIS IS THE NEW, SEPARATE LOGIC FOR THE DATE STEP --- */}
                  {currentStep === 'date_selection' && (
                    <>
                      <input
                        type="date"
                        className="chat-input"
                        value={currentInput}
                        disabled={isProcessing || serverStatus !== 'online'}
                        // This is the most important change: onChange now triggers the validation automatically!
                        onChange={(e) => {
                          setCurrentInput(e.target.value); // Update the visual input
                          handleDateValidation(e.target.value); // Immediately call the validation function
                        }}
                        // This is a helpful addition to prevent users from picking past dates
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {/* Notice there is NO "Send" button here, because the action is automatic. */}
                    </>
                  )}

                  {currentStep === 'summary' && (
                    <div className="summary-actions">
                      <button className="confirm-order-button" onClick={submitOrder} disabled={isProcessing}> 
                        ✔️ Yes, Place Order
                      </button>
                      <button className="reset-button" style={{margin: '0 0 0 10px'}} onClick={cancelOrder} disabled={isProcessing}>
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
        {message && currentStep !== 'order_complete' && (
          <div className={`message ${messageType}`} style={{ whiteSpace: 'pre-line' }}>
            {message}
          </div>
        )}

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
                <div className="stat-label">Characters</div>
              </div>
               <div className="stat-item">
                <div className="stat-value">{processingStats.total_chars?.toLocaleString()}</div>
                <div className="stat-label">Total Chars</div>
              </div>
               <div className="stat-item">
                <div className="stat-value">{fullCatalog.length}</div>
                <div className="stat-label">Catalog Items</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ textAlign: 'center', background: '#f8f9fa' }}>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>How it works:</h3>
        <p style={{ color: '#888', lineHeight: 1.6 }}>
          1. Upload your restaurant catalog (Excel/CSV recommended for structured data).<br />
          2. Click "Process Catalog" to analyze the menu and stock.
          3. Follow the prompts to select items, quantities, and delivery details.
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