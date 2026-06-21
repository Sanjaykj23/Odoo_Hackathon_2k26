const fs = require('fs');
const path = './frontend/src/components/pos/POSView.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Imports
content = content.replaceAll(
  `Check, AlertCircle, X, MapPin, Layers`,
  `Check, AlertCircle, Trash2, X, MapPin, Layers`
);
content = content.replaceAll(
  `CheckCircle2, History, Banknote, Smartphone`,
  `CheckCircle2, History, Banknote, Smartphone, CreditCard`
);

// 2. States
content = content.replaceAll(
  `const [customerName, setCustomerName] = useState('');`,
  `const [customerName, setCustomerName] = useState('');\n  const [customerPhone, setCustomerPhone] = useState('');`
);
content = content.replaceAll(
  `const [selectedTableId, setSelectedTableId] = useState('');`,
  `const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);\n  const [guestCount, setGuestCount] = useState<number>(1);`
);
content = content.replaceAll(
  `const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash');`,
  `const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Razorpay'>('Cash');`
);

// 3. Razorpay Load
content = content.replaceAll(
  `  // Initialize POS config and WebSockets\n  useEffect(() => {\n    if (!token) return;`,
  `  // Initialize POS config and WebSockets\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = 'https://checkout.razorpay.com/v1/checkout.js';\n    script.async = true;\n    document.body.appendChild(script);\n\n    if (!token) return;`
);

// 4. Kitchen Dispatch
content = content.replaceAll(
  `    if (!selectedTableId) {\n      alert('Table selection is mandatory to place an order.');`,
  `    if (selectedTableIds.length === 0) {\n      alert('Table selection is mandatory to place an order.');`
);
content = content.replaceAll(
  `    onSendToKitchen(cart, resolvedCustomer, appliedPromo, orderNotes, selectedTableId);\n    \n    // Clear states\n    setCart([]);\n    setCustomerName('');\n    setAppliedPromo(null);\n    setOrderNotes('');\n    setSelectedTableId('');`,
  `    onSendToKitchen(cart, resolvedCustomer, appliedPromo, orderNotes, selectedTableIds.join(','));\n    \n    // Clear states\n    setCart([]);\n    setCustomerName('');\n    setCustomerPhone('');\n    setAppliedPromo(null);\n    setOrderNotes('');\n    setSelectedTableIds([]);`
);

// 5. Payment Dispatch
content = content.replaceAll(
  `    if (!selectedTableId) {\n      alert('Table selection is mandatory to proceed to payment.');`,
  `    if (selectedTableIds.length === 0) {\n      alert('Table selection is mandatory to proceed to payment.');`
);
content = content.replaceAll(
  `    if (cart.length === 0 || !token || !activeSession || !selectedTableId) return;`,
  `    if (cart.length === 0 || !token || !activeSession || selectedTableIds.length === 0) return;`
);
content = content.replaceAll(
  `      table_id: selectedTableId,`,
  `      table_id: selectedTableIds.join(','),\n      guest_count: guestCount,`
);

// 6. Razorpay Flow integration
const payFlowMatch = `      // 2. Submit payment to record transaction and mark order Paid
      const payResponse = await fetch(\`/api/orders/\${orderData.id}/pay\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          payment_method: paymentMethod,
          transaction_ref: transactionRef,
          amount: totals.total
        })
      });
      const payData = await payResponse.json();
      if (!payResponse.ok) {
        throw new Error(payData.error || 'Failed to process payment.');
      }`;
      
const rzpReplacement = `      if (paymentMethod === 'Razorpay') {
        const rzpRes = await fetch('/api/payments/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
          body: JSON.stringify({ order_id: orderData.id })
        });
        const rzpData = await rzpRes.json();
        if (!rzpRes.ok) throw new Error(rzpData.error || 'Failed to init Razorpay');

        const options = {
          key: rzpData.key,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: 'Odoo Cafe',
          description: \`POS Order #\${orderData.order_number}\`,
          order_id: rzpData.razorpay_order_id,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
                body: JSON.stringify({
                  order_id: orderData.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');
              
              setCheckoutProcessing(false);
              setShowPaymentModal(false);
              setRecentOrderNum(orderData.order_number);
              setShowCheckoutSuccess(true);
            } catch (err: any) {
              alert(err.message || 'Payment Verification Failed');
              setCheckoutProcessing(false);
            }
          },
          prefill: { name: resolvedCustomer, contact: customerPhone || '' },
          theme: { color: '#9333ea' }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert('Payment failed: ' + response.error.description);
          setCheckoutProcessing(false);
        });
        rzp.open();
        return;
      }

      // 2. Submit payment to record transaction and mark order Paid
      const payResponse = await fetch(\`/api/orders/\${orderData.id}/pay\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          payment_method: paymentMethod,
          transaction_ref: transactionRef,
          amount: totals.total
        })
      });
      const payData = await payResponse.json();
      if (!payResponse.ok) {
        throw new Error(payData.error || 'Failed to process payment.');
      }`;

content = content.replaceAll(payFlowMatch, rzpReplacement);

// Clear logic
content = content.replaceAll(
  `    setCustomerName('');\n    setAppliedPromo(null);\n    setOrderNotes('');\n    setRecentOrderNum('');\n    setSelectedTableId('');`,
  `    setCustomerName('');\n    setCustomerPhone('');\n    setAppliedPromo(null);\n    setOrderNotes('');\n    setRecentOrderNum('');\n    setSelectedTableIds([]);`
);

content = content.replaceAll(
  `    setSelectedTableId(tableId);`,
  `    if (!selectedTableIds.includes(tableId)) setSelectedTableIds([...selectedTableIds, tableId]);`
);

// Grid rendering
content = content.replaceAll(
  `                          Occupied: { border: 'border-rose-200 hover:border-rose-300', bg: 'bg-rose-50/30', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },\n                          Reserved: { border: 'border-amber-200 hover:border-amber-300', bg: 'bg-amber-50/20', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },`,
  `                          Occupied: { border: 'border-rose-200 hover:border-rose-300', bg: 'bg-rose-50/30', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },\n                          'Partially Occupied': { border: 'border-orange-200 hover:border-orange-300', bg: 'bg-orange-50/30', badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500 animate-pulse' },\n                          Reserved: { border: 'border-amber-200 hover:border-amber-300', bg: 'bg-amber-50/20', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },`
);
content = content.replaceAll(
  `const isSelected = selectedTableId === table.id;`,
  `const isSelected = selectedTableIds.includes(table.id);`
);
content = content.replaceAll(
  `<option value="Occupied">Occupied</option>\n                                  <option value="Reserved">Reserved</option>`,
  `<option value="Occupied">Occupied</option>\n                                  <option value="Partially Occupied">Partially Occupied</option>\n                                  <option value="Reserved">Reserved</option>`
);

// Customer Input Row
content = content.replaceAll(
  `            {/* Customer Name Input */}\n            <div className="relative pb-3 border-b border-[#e2e8f0]">\n              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none mb-3">\n                <User className="w-3 h-3 text-slate-400" />\n              </div>\n              <input\n                type="text"\n                placeholder="Walk-in Customer Name (Optional)"\n                value={customerName}\n                onChange={(e) => setCustomerName(e.target.value)}\n                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800 transition-shadow"\n              />\n            </div>`,
  `            {/* Customer Details Row */}\n            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#e2e8f0]">\n              <div className="relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <User className="w-3 h-3 text-slate-400" />\n                </div>\n                <input\n                  type="text"\n                  placeholder="Customer Name (Optional)"\n                  value={customerName}\n                  onChange={(e) => setCustomerName(e.target.value)}\n                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800 transition-shadow"\n                />\n              </div>\n              <div className="relative">\n                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">\n                  <Smartphone className="w-3 h-3 text-slate-400" />\n                </div>\n                <input\n                  type="text"\n                  placeholder="Phone Number"\n                  value={customerPhone}\n                  onChange={(e) => setCustomerPhone(e.target.value)}\n                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800 transition-shadow"\n                />\n              </div>\n            </div>`
);

// Table Selector Group
const oldSelectGroup = `          {/* Floor Seating Table Picker */}
          <div className="space-y-1">
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo text-slate-700 font-semibold"
            >
              <option value="">-- Select Table (Required) --</option>
              {Object.entries(
                tables.reduce((acc, t) => {
                  const fName = t.floor_name || 'Main Floor';
                  if (!acc[fName]) acc[fName] = [];
                  acc[fName].push(t);
                  return acc;
                }, {} as Record<string, typeof tables>)
              ).map(([floorName, floorTables]) => (
                <optgroup key={floorName} label={floorName}>
                  {floorTables.map((t) => (
                    <option 
                      key={t.id} 
                      value={t.id}
                      className={t.status === 'Occupied' ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}
                    >
                      Table {t.number} ({t.capacity} seats) - {t.status}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {selectedTableId && (() => {
              const selectedTable = tables.find(t => t.id === selectedTableId);
              if (!selectedTable) return null;
              const statusColors = {
                Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                Occupied: 'bg-rose-50 text-rose-700 border-rose-200',
                Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
                Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'
              };
              const color = statusColors[selectedTable.status] || statusColors.Available;
              return (
                <div className={\`flex items-center justify-between text-[10px] px-2 py-1.5 border rounded-lg \${color}\`}>
                  <span className="font-bold">Table {selectedTable.number} ({selectedTable.capacity} seats)</span>
                  <span className="font-bold px-1.5 py-0.5 rounded bg-white/50">{selectedTable.status}</span>
                </div>
              );
            })()}
          </div>`;
          
const newSelectGroup = `          {/* Floor Seating Table Picker */}
          <div className="space-y-1">
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !selectedTableIds.includes(val)) setSelectedTableIds([...selectedTableIds, val]);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo text-slate-700 font-semibold"
            >
              <option value="">-- Add Table (Required) --</option>
              {Object.entries(
                tables.reduce((acc, t) => {
                  const fName = t.floor_name || 'Main Floor';
                  if (!acc[fName]) acc[fName] = [];
                  acc[fName].push(t);
                  return acc;
                }, {} as Record<string, typeof tables>)
              ).map(([floorName, floorTables]) => (
                <optgroup key={floorName} label={floorName}>
                  {floorTables.map((t) => (
                    <option 
                      key={t.id} 
                      value={t.id}
                      className={t.status === 'Occupied' ? 'text-red-500 font-medium' : t.status === 'Partially Occupied' ? 'text-orange-500 font-medium' : 'text-emerald-600 font-medium'}
                    >
                      Table {t.number} ({t.capacity} seats) - {t.status}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Display Selected Tables as Tags */}
            {selectedTableIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedTableIds.map(tid => {
                  const tableObj = tables.find(t => t.id === tid);
                  return (
                    <div key={tid} className="flex items-center gap-1 bg-odoo text-white text-[10px] px-2 py-1 rounded-md font-bold">
                      T{tableObj?.number} ({tableObj?.capacity}s)
                      <button onClick={() => setSelectedTableIds(selectedTableIds.filter(id => id !== tid))} className="ml-1 hover:text-red-200">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Guest Count Input */}
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Number of Guests</label>
              <input 
                type="number" 
                min="1"
                value={guestCount}
                onChange={e => setGuestCount(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo text-slate-700 font-semibold"
              />
            </div>

            {selectedTableIds.length > 0 && (() => {
              const selectedTables = selectedTableIds.map(id => tables.find(t => t.id === id)).filter(Boolean) as SeatingTable[];
              if (selectedTables.length === 0) return null;
              
              const totalSeats = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
              const anyOccupied = selectedTables.some(t => t.status === 'Occupied' || t.status === 'Partially Occupied');
              
              const statusColors: Record<string, string> = {
                Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                Occupied: 'bg-rose-50 text-rose-700 border-rose-200',
                'Partially Occupied': 'bg-orange-50 text-orange-700 border-orange-200',
                Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
                Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'
              };
              const color = anyOccupied ? statusColors.Occupied : statusColors.Available;
              return (
                <div className={\`flex flex-col gap-1 text-[10px] px-2 py-1.5 border rounded-lg mt-2 \${color}\`}>
                  <div className="flex justify-between font-bold">
                    <span>Selected Tables: {selectedTables.map(t => t.number).join(', ')}</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/50">{anyOccupied ? 'Occupied/Partial' : 'Available'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Capacity: {totalSeats} seats</span>
                    <span>Guests: {guestCount}</span>
                  </div>
                  {guestCount > totalSeats && (
                    <div className="text-rose-600 font-bold mt-1">Warning: Guest count exceeds total capacity!</div>
                  )}
                </div>
              );
            })()}
          </div>`;

content = content.replaceAll(oldSelectGroup, newSelectGroup);

// Payment Selection Modal UI
content = content.replaceAll(
  `                  {selectedTableId && (\n                    <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-[10px] font-semibold text-slate-300">\n                      Table: {tables.find(t => t.id === selectedTableId)?.number}\n                    </span>\n                  )}`,
  `                  {selectedTableIds.length > 0 && (\n                    <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-[10px] font-semibold text-slate-300">\n                      Table(s): {selectedTableIds.map(id => tables.find(t => t.id === id)?.number).join(', ')} | Guests: {guestCount}\n                    </span>\n                  )}`
);

content = content.replaceAll(
  `                    {[\n                      { id: 'Cash', label: 'Cash' },\n                      { id: 'Card', label: 'Card Term' },\n                      { id: 'UPI', label: 'UPI / App' }\n                    ].map((method) => {`,
  `                    {[\n                      { id: 'Cash', label: 'Cash', icon: Banknote },\n                      { id: 'Card', label: 'Card Term', icon: CreditCard },\n                      { id: 'UPI', label: 'UPI / App', icon: Smartphone },\n                      { id: 'Razorpay', label: 'Razorpay', icon: CreditCard }\n                    ].map((method) => {`
);

content = content.replaceAll(
  `                          {method.id === 'Cash' && <Banknote className={\`w-4 h-4 \${isSelected ? 'text-white' : 'text-slate-500'}\`} />}\n                          {method.id === 'Card' && <CreditCard className={\`w-4 h-4 \${isSelected ? 'text-white' : 'text-slate-500'}\`} />}\n                          {method.id === 'UPI' && <Smartphone className={\`w-4 h-4 \${isSelected ? 'text-white' : 'text-slate-500'}\`} />}\n                          {method.label}`,
  `                          {method.icon && <method.icon className={\`w-4 h-4 \${isSelected ? 'text-white' : 'text-slate-500'}\`} />}\n                          {method.label}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched POSView.tsx successfully with Razorpay and Tables.');
