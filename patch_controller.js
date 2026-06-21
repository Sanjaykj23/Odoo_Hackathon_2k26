const fs = require('fs');
const path = './src/controllers/orderController.js';

let content = fs.readFileSync(path, 'utf8');

const oldQ1 = `SELECT o.*, t.table_number FROM orders o \n           LEFT JOIN tables t ON o.table_id = t.id`;
const newQ1 = `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o`;

content = content.replaceAll(oldQ1, newQ1);

const oldQ2 = `SELECT o.*, t.table_number, p.name as product_name, p.price, oi.quantity, oi.unit_price, oi.line_total\n    FROM orders o\n    LEFT JOIN tables t ON o.table_id = t.id`;
const newQ2 = `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number, p.name as product_name, p.price, oi.quantity, oi.unit_price, oi.line_total\n    FROM orders o`;

content = content.replaceAll(oldQ2, newQ2);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed listOrders table_id joins!');
