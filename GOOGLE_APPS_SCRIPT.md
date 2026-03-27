# Google Apps Script Setup

**IMPORTANT: If you are updating your app, you MUST copy this new code and RE-DEPLOY as a Web App to ensure the "Amount" column and other new features work correctly.**

Copy and paste this code into your Google Sheet's Script Editor (**Extensions > Apps Script**).

## 1. The Code (`Code.gs`)

```javascript
/**
 * SOCIAL SELLER ORDER MANAGER - BACKEND
 * 
 * Instructions:
 * 1. Create a Google Sheet.
 * 2. Name the first sheet "Orders".
 * 3. Add these headers to "Orders" (Row 1): 
 *    orderId, sellerId, customerName, item, itemPhotoUrl, quantity, size, phone, instagramId, location, city, state, pincode, paymentMethod, orderStatus, paymentStatus, createdAt, amount, flocation
 *    (CRITICAL: "amount" MUST be in Column R. "flocation" MUST be in Column S.)
 * 4. Name the second sheet "Sellers".
 * 5. Add these headers to "Sellers":
 *    sellerId, password, storeName, status
 * 6. Create a folder in Google Drive for uploads and copy its ID.
 * 7. Replace FOLDER_ID below with your folder ID.
 * 8. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 * 
 * CRITICAL: The doGet function is required for fetching data. 
 * If you see "Social Seller API is running" in your app, it means you need to re-deploy.
 */

const FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE'; // <-- REPLACE THIS

function doGet(e) {
  const action = e.parameter.action;
  
  if (!action) {
    return ContentService.createTextOutput("Social Seller API is running.");
  }

  let result = { success: false, message: 'Action not handled: ' + action };
  
  if (action === 'getOrders') result = getOrders(e.parameter.sellerId);
  if (action === 'getStoreInfo') result = getStoreInfo(e.parameter);
  if (action === 'healthCheck') result = { success: true, message: 'API is healthy' };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'createOrder') {
    return ContentService.createTextOutput(JSON.stringify(createOrder(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'updateStatus') {
    return ContentService.createTextOutput(JSON.stringify(updateStatus(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'uploadImage') {
    return ContentService.createTextOutput(JSON.stringify(uploadImage(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'sellerLogin') {
    return ContentService.createTextOutput(JSON.stringify(sellerLogin(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getStoreInfo') {
    return ContentService.createTextOutput(JSON.stringify(getStoreInfo(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrders(sellerId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data.shift().map(h => String(h).trim().toLowerCase());
  const targetId = String(sellerId || '').trim().toLowerCase();
  
  const orders = data
    .filter(row => String(row[1]).trim().toLowerCase() === targetId)
    .map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        if (!header) return;
        // Map common headers to camelCase for the frontend
        let key = header;
        if (header === 'orderid') key = 'orderId';
        if (header === 'sellerid') key = 'sellerId';
        if (header === 'customername') key = 'customerName';
        if (header === 'itemphotourl') key = 'itemPhotoUrl';
        if (header === 'orderstatus') key = 'orderStatus';
        if (header === 'paymentstatus') key = 'paymentStatus';
        if (header === 'createdat') key = 'createdAt';
        if (header === 'paymentmethod') key = 'paymentMethod';
        if (header === 'instagramid') key = 'instagramId';
        
        obj[key] = row[i];
      });
      return obj;
    });
    
  return orders.reverse(); // Newest first
}

function createOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  if (!sheet) return { success: false, message: 'Sheet "Orders" not found' };
  
  // 1. Handle Image Upload (if not already uploaded)
  let imageUrl = data.itemPhotoUrl || '';
  try {
    if (!imageUrl && data.image && FOLDER_ID && FOLDER_ID !== 'YOUR_DRIVE_FOLDER_ID_HERE') {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const contentType = data.image.split(',')[0].split(':')[1].split(';')[0];
      const bytes = Utilities.base64Decode(data.image.split(',')[1]);
      const fileName = `order_${data.customerName || 'unknown'}_${Date.now()}.png`.replace(/[^a-z0-9_.]/gi, '_');
      const file = folder.createFile(Utilities.newBlob(bytes, contentType, fileName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrl = file.getUrl();
    }
  } catch (imageErr) {
    console.error('Image Upload Error:', imageErr);
  }
  
  // 2. Prepare Order Data
  const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const orderData = {
    orderid: orderId,
    sellerid: data.sellerId,
    customername: data.customerName,
    item: data.item,
    itemphotourl: imageUrl,
    quantity: data.quantity,
    size: data.size,
    phone: data.phone,
    instagramid: data.instagramId || '',
    location: data.flocation || data.location || '', // Save to both for safety
    flocation: data.flocation || data.location || '', // Save to both for safety
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    paymentmethod: data.paymentMethod,
    remarks: data.remarks || '',
    orderstatus: 'pending',
    paymentstatus: 'unpaid',
    createdat: new Date(),
    amount: 0
  };

  // 3. Map Data to Columns based on Headers
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());
  
  const newRow = headers.map(header => {
    if (!header) return '';
    // Check if we have data for this header
    return orderData[header] !== undefined ? orderData[header] : '';
  });

  // 4. Append the Row
  try {
    sheet.appendRow(newRow);
    console.log('Order created successfully:', orderId);
    return { success: true, orderId: orderId };
  } catch (err) {
    console.error('Append Row Error:', err);
    return { success: false, message: 'Failed to save to sheet: ' + err.message };
  }
}

function uploadImage(data) {
  try {
    if (data.image && FOLDER_ID && FOLDER_ID !== 'YOUR_DRIVE_FOLDER_ID_HERE') {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const contentType = data.image.split(',')[0].split(':')[1].split(';')[0];
      const bytes = Utilities.base64Decode(data.image.split(',')[1]);
      const fileName = `temp_${Date.now()}.png`;
      const file = folder.createFile(Utilities.newBlob(bytes, contentType, fileName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return { success: true, imageUrl: file.getUrl() };
    }
    return { success: false, message: 'No image data or folder ID' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function updateStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  if (!sheet) return { success: false, message: 'Sheet "Orders" not found' };
  
  const dataRange = sheet.getDataRange();
  const rows = dataRange.getValues();
  if (rows.length < 2) return { success: false, message: 'No data in sheet' };
  
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const orderIdCol = headers.indexOf('orderid');
  
  if (orderIdCol === -1) return { success: false, message: 'orderId column not found' };
  
  // Find the column to update
  const targetHeader = String(data.type).toLowerCase();
  const updateCol = headers.indexOf(targetHeader);
  
  if (updateCol === -1) return { success: false, message: 'Column "' + data.type + '" not found' };
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIdCol]) === String(data.orderId)) {
      sheet.getRange(i + 1, updateCol + 1).setValue(data.status);
      return { success: true };
    }
  }
  return { success: false, message: 'Order not found' };
}

function sellerLogin(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sellers');
  if (!sheet) return { success: false, message: 'Sellers sheet not found' };
  
  const rows = sheet.getDataRange().getValues();
  const targetId = String(data.sellerId || '').trim().toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    const sheetId = String(rows[i][0]).trim().toLowerCase();
    if (sheetId === targetId && rows[i][1].toString() === data.password.toString()) {
      const status = rows[i][3] || 'active';
      return { 
        success: true, 
        storeName: rows[i][2],
        status: status
      };
    }
  }
  return { success: false, message: 'Invalid credentials' };
}

function getStoreInfo(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sellers');
  if (!sheet) return { success: false, message: 'Sellers sheet not found' };
  
  const rows = sheet.getDataRange().getValues();
  const targetId = String(data.sellerId || '').trim().toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    const sheetId = String(rows[i][0]).trim().toLowerCase();
    if (sheetId === targetId) {
      return { 
        success: true, 
        storeName: rows[i][2]
      };
    }
  }
  return { success: false, message: 'Store not found' };
}
```
