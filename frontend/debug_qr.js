// Debug script to test QR code functionality in browser console

// Step 1: Test basic elements exist
console.log('=== QR Code Debug Test ===');

// Check if QR button exists
const qrBtn = document.getElementById('addQRBtn');
console.log('QR Button found:', qrBtn);
console.log('QR Button display:', qrBtn ? qrBtn.style.display : 'N/A');

// Check if QR notice exists  
const qrNotice = document.getElementById('qrNotice');
console.log('QR Notice found:', qrNotice);
console.log('QR Notice display:', qrNotice ? qrNotice.style.display : 'N/A');

// Check if image file exists
const testImg = new Image();
testImg.onload = () => console.log('✅ QR_Website.png loads successfully');
testImg.onerror = () => console.log('❌ QR_Website.png failed to load');
testImg.src = 'QR_Website.png';

// Check if frontCard container exists
const frontCard = document.getElementById('frontCard');
console.log('Front Card container found:', frontCard);

// Check cardDesigner object
if (typeof cardDesigner !== 'undefined') {
    console.log('CardDesigner object exists');
    console.log('Current material:', cardDesigner.currentMaterial);
    console.log('Current template:', cardDesigner.currentTemplate);
    console.log('Current side:', cardDesigner.currentSide);
    console.log('Elements:', cardDesigner.elements);
    
    // Test the QR function manually
    console.log('Testing addQRCode function...');
    try {
        cardDesigner.addQRCode();
    } catch (error) {
        console.error('QR Code function error:', error);
    }
} else {
    console.log('❌ CardDesigner object not found');
}

console.log('=== Debug Test Complete ===');