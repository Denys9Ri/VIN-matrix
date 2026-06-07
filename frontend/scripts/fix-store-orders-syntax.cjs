const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/pages/StoreOrdersDictionaryBoard.jsx');
let src = fs.readFileSync(file, 'utf8');

// Surgical fix for PartsPanel JSX: parts.map(...) had one extra closing parenthesis.
src = src.replace(
  'onClick={() => onDelete(p)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600"><Trash2 size={14}/></button></div></div></div>))}</div></Panel>; }',
  'onClick={() => onDelete(p)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600"><Trash2 size={14}/></button></div></div></div>)}</div></Panel>; }'
);

fs.writeFileSync(file, src);
console.log('StoreOrdersDictionaryBoard.jsx syntax guard applied.');
