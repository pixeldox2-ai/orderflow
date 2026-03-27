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
 *    orderId, sellerId, customerName, item, itemPhotoUrl, quantity, size, phone, instagramId, address, city, state, pincode, paymentMethod, orderStatus, paymentStatus, createdAt, amount
 *    (CRITICAL: "amount" MUST be in Column R. If it's not there, the amount won't save!)
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
  
  const headers = data.shift();
  const targetId = String(sellerId || '').trim().toLowerCase();
  
  const orders = data
    .filter(row => String(row[1]).trim().toLowerCase() === targetId)
    .map(row => {
      let obj = {};
      headers.forEach((header, i) => obj[header] = row[i]);
      return obj;
    });
    
  return orders.reverse(); // Newest first
}

function createOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  
  let imageUrl = '';
  if (data.image) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const contentType = data.image.split(',')[0].split(':')[1].split(';')[0];
    const bytes = Utilities.base64Decode(data.image.split(',')[1]);
    const file = folder.createFile(Utilities.newBlob(bytes, contentType, `order_${Date.now()}.png`));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    imageUrl = file.getUrl();
  }
  
  const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const row = [
    orderId,
    data.sellerId,
    data.customerName,
    data.item,
    imageUrl,
    data.quantity,
    data.size,
    data.phone,
    data.instagramId || '',
    data.address,
    data.city,
    data.state,
    data.pincode,
    data.paymentMethod,
    'pending', // Default orderStatus
    'unpaid',  // Default paymentStatus
    new Date(),
    0          // Default amount
  ];
  
  sheet.appendRow(row);
  return { success: true, orderId: orderId };
}

function updateStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Orders');
  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      if (data.type === 'orderStatus') sheet.getRange(i + 1, 15).setValue(data.status);
      if (data.type === 'paymentStatus') sheet.getRange(i + 1, 16).setValue(data.status);
      if (data.type === 'amount') sheet.getRange(i + 1, 18).setValue(data.status);
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
