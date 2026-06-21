const fs = require('fs');
const path = './frontend/src/components/pos/POSView.tsx';

let content = fs.readFileSync(path, 'utf8');

content = content.replaceAll('setSelectedTableId(', 'setSelectedTableIds([');

// For selectedTableId exact usages
content = content.replaceAll('if (!selectedTableId)', 'if (selectedTableIds.length === 0)');
content = content.replaceAll('|| !selectedTableId)', '|| selectedTableIds.length === 0)');
content = content.replace(/table_id:\s*selectedTableId/g, 'table_id: selectedTableIds.join(",")');

content = content.replace(/setSelectedTableIds\(\[''\}\)/g, 'setSelectedTableIds([])');
content = content.replaceAll('setSelectedTableIds([""])', 'setSelectedTableIds([])');
content = content.replaceAll('setSelectedTableIds([])', 'setSelectedTableIds([])');

content = content.replaceAll(`const isSelected = selectedTableId === table.id;`, `const isSelected = selectedTableIds.includes(table.id);`);

// Status color missing Partially Occupied
content = content.replaceAll(
`              const statusColors = {
                Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                Occupied: 'bg-rose-50 text-rose-700 border-rose-200',
                Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
                Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'
              };`,
`              const statusColors = {
                Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                Occupied: 'bg-rose-50 text-rose-700 border-rose-200',
                'Partially Occupied': 'bg-orange-50 text-orange-700 border-orange-200',
                Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
                Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'
              };`
);

// Any leftover selectedTableId (just replace with selectedTableIds[0] for logging or generic)
content = content.replace(/selectedTableId/g, 'selectedTableIds[0]');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed POSView.tsx globally');
