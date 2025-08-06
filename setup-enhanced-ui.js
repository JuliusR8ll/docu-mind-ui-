const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Enhanced UI...\n');

// Paths
const currentPagePath = path.join(__dirname, 'app', 'page.js');
const enhancedPagePath = path.join(__dirname, 'app', 'page-enhanced.js');
const backupPagePath = path.join(__dirname, 'app', 'page-backup.js');

try {
  // 1. Backup current page
  if (fs.existsSync(currentPagePath)) {
    fs.copyFileSync(currentPagePath, backupPagePath);
    console.log('✅ Backed up current page.js to page-backup.js');
  }

  // 2. Replace with enhanced version
  if (fs.existsSync(enhancedPagePath)) {
    fs.copyFileSync(enhancedPagePath, currentPagePath);
    console.log('✅ Replaced page.js with enhanced version');
  } else {
    console.log('❌ Enhanced page not found!');
    process.exit(1);
  }

  console.log('\n🎉 Enhanced UI setup complete!');
  console.log('\n📋 What changed:');
  console.log('  • Added backend server selection (Original, Improved, Grok)');
  console.log('  • Server health monitoring');
  console.log('  • Debug information display');
  console.log('  • Answer quality indicators');
  console.log('  • Enhanced error handling');
  console.log('  • Raw PDF content detection');
  
  console.log('\n🚀 Next steps:');
  console.log('  1. Start your backend server: npm run dev:grok (in backend folder)');
  console.log('  2. Start the UI: npm run dev');
  console.log('  3. Open http://localhost:3000');
  console.log('  4. Select "Grok AI Server" in the UI');
  console.log('  5. Upload PDF and test questions');

  console.log('\n🔄 To restore original UI:');
  console.log('  • Copy page-backup.js back to page.js');

} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}
