import './globals.css'

export const metadata = {
  title: 'Docu-Mind - PDF Chatbot',
  description: 'Chat with your PDF documents using AI',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
