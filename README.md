# Docu-Mind UI (Next.js)

A simple and elegant frontend for the Docu-Mind PDF chatbot, built with Next.js and React.

## Features

- Clean and intuitive user interface
- PDF file upload with drag-and-drop support
- Real-time processing status
- Question and answer interface
- Responsive design
- Loading states and error handling
- Modern gradient design

## Prerequisites

- Node.js 18+ installed
- Docu-Mind backend running (see backend README)

## Installation

1. Navigate to the frontend directory:
```bash
cd docu-mind-ui
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

The application will be available at `http://localhost:3000`.

## Configuration

Update the `API_BASE_URL` in `app/page.js` to point to your backend server:

```javascript
const API_BASE_URL = 'http://localhost:8000'; // Change this to your backend URL
```

For production, you might want to use environment variables:

```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

## How to Use

1. **Upload PDFs**: Click "Select PDFs" and choose one or more PDF files
2. **Process Documents**: Click "Process PDFs" to analyze the documents
3. **Ask Questions**: Once processing is complete, enter your questions in the input field
4. **Get Answers**: The AI will provide answers based on the content of your PDFs

## Features

### File Upload
- Multiple PDF file selection
- File type validation (PDF only)
- File size display
- Real-time upload status

### Question Interface
- Text input with Enter key support
- Disabled state until PDFs are processed
- Loading indicators during processing

### Answer Display
- Formatted answer section
- Clear visual separation
- Responsive design

### Status Messages
- Success, error, and info messages
- Color-coded message types
- Real-time feedback

## Styling

The application uses custom CSS with:
- Modern gradient backgrounds
- Smooth animations and transitions
- Responsive design for mobile devices
- Clean card-based layout
- Professional color scheme

## Dependencies

- **next**: React framework
- **react**: JavaScript library for building user interfaces
- **react-dom**: React DOM bindings
- **axios**: HTTP client for API calls

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Responsive Design

The UI is fully responsive and works on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## Error Handling

The frontend handles various error scenarios:
- Network connection errors
- Backend server errors
- File upload errors
- Invalid file types
- Empty responses

## Future Enhancements

Potential improvements:
- Chat history
- Multiple document sessions
- File management (delete uploaded files)
- Dark mode support
- Export answers
- Keyboard shortcuts

## License

MIT License
