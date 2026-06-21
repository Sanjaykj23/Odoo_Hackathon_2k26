const fs = require('fs');
const path = './frontend/src/components/pos/POSView.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace Table Picker
const oldSelectGroup = /\{\/\* Floor Seating Table Picker \*\/\}\s*<div className="space-y-1">\s*<select\s*value=\{selectedTableId\}\s*onChange=\{\(e\) => setSelectedTableId\(e\.target\.value\)\}\s*className="w-full px-2\.5 py-1\.5 text-xs bg-white border border-\[\#e2e8f0\] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo text-slate-700 font-semibold"\s*>\s*<option value="">-- Select Table \(Required\) --<\/option>\s*\{Object\.entries\(\s*tables\.reduce\(\(acc, t\) => \{\s*const fName = t\.floor_name \|\| 'Main Floor';\s*if \(\!acc\[fName\]\) acc\[fName\] = \[\];\s*acc\[fName\]\.push\(t\);\s*return acc;\s*\}, \{\} as Record<string, typeof tables>\)\s*\)\.map\(\(\[floorName, floorTables\]\) => \(\s*<optgroup key=\{floorName\} label=\{floorName\}>\s*\{floorTables\.map\(\(t\) => \(\s*<option \s*key=\{t\.id\} \s*value=\{t\.id\}\s*className=\{t\.status === 'Occupied' \? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'\}\s*>\s*Table \{t\.number\} \(\{t\.capacity\} seats\) - \{t\.status\}\s*<\/option>\s*\)\)\}\s*<\/optgroup>\s*\)\)\}\s*<\/select>\s*\{selectedTableId && \(\(\) => \{\s*const selectedTable = tables\.find\(t => t\.id === selectedTableId\);\s*if \(\!selectedTable\) return null;\s*const statusColors = \{\s*Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',\s*Occupied: 'bg-rose-50 text-rose-700 border-rose-200',\s*Reserved: 'bg-amber-50 text-amber-700 border-amber-200',\s*Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'\s*\};\s*const color = statusColors\[selectedTable\.status\] \|\| statusColors\.Available;\s*return \(\s*<div className=\{\`flex items-center justify-between text-\[10px\] px-2 py-1\.5 border rounded-lg \$\{color\}\`\}>\s*<span>Seats: <strong className="font-bold">\{selectedTable\.capacity\}<\/strong><\/span>\s*<span className="font-bold uppercase tracking-wider text-\[9px\]">\{selectedTable\.status\}<\/span>\s*<\/div>\s*\);\s*\}\)\(\)\}\s*<\/div>/g;
          
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

content = content.replace(oldSelectGroup, newSelectGroup);

// Other misses
content = content.replace(/\{selectedTableId && \(/g, '{selectedTableIds.length > 0 && (');
content = content.replace(/Table: \{tables\.find\(t => t\.id === selectedTableId\)\?\.number\}/g, 'Table(s): {selectedTableIds.map(id => tables.find(t => t.id === id)?.number).join(", ")} | Guests: {guestCount}');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed selectedTableId instances!');
