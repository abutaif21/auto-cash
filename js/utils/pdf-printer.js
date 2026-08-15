export function printReceipt(data) {
  const printWindow = window.open('', '_blank', 'width=350,height=500');
  
  const receiptHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>إيصال - ${data.plateNumber || 'سيارة'}</title>
      <style>
        body {
          font-family: monospace, system-ui;
          width: 280px;
          margin: 0 auto;
          padding: 10px;
          color: #000;
        }
        .text-center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
        .title { font-size: 18px; font-weight: bold; }
        .price { font-size: 16px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">أوتوكاش - Auto Cash</div>
        <div style="font-size: 12px;">إيصال موقف سيارات</div>
      </div>
      <div class="divider"></div>
      <div class="row"><span>نوع السيارة:</span><span>${data.carType}</span></div>
      <div class="row"><span>رقم اللوحة:</span><span>${data.plateNumber}</span></div>
      <div class="row"><span>المربع:</span><span>${data.boxNumber || '-'}</span></div>
      <div class="row"><span>تاريخ الدخول:</span><span style="direction: ltr;">${data.entryDate}</span></div>
      <div class="divider"></div>
      <div class="row price"><span>المبلغ الإجمالي:</span><span>${data.price || 0} ريال</span></div>
      <div class="divider"></div>
      <div class="text-center" style="font-size: 11px; margin-top: 10px;">
        شكراً لزيارتكم<br>يرجى الاحتفاظ بالإيصال
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
