import fs from 'fs';

const files = [
  'src/App.tsx',
  'src/components/ChatMessage.tsx',
  'src/components/MediaViewer.tsx'
];

const classMap: Record<string, string> = {
  'bg-nova-dark': 'bg-white dark:bg-nova-dark',
  'bg-nova-surface': 'bg-gray-50 dark:bg-nova-surface',
  'text-gray-200': 'text-gray-800 dark:text-gray-200',
  'text-gray-300': 'text-gray-700 dark:text-gray-300',
  'text-gray-400': 'text-gray-600 dark:text-gray-400',
  'border-gray-700': 'border-gray-200 dark:border-gray-700',
  'border-gray-800': 'border-gray-200 dark:border-gray-800',
  'text-white': 'text-gray-900 dark:text-white',
  // 'hover:text-white' shouldn't conflict with text-white if we do word boundaries
  'hover:text-white': 'hover:text-gray-900 dark:hover:text-white',
  'hover:bg-white/5': 'hover:bg-gray-200 dark:hover:bg-white/5',
  'hover:bg-white/20': 'hover:bg-gray-200 dark:hover:bg-white/20',
  'bg-white/10': 'bg-gray-100 dark:bg-white/10',
};

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  
  for (const [darkClass, combined] of Object.entries(classMap)) {
    // Only replace if it doesn't already contain the combined version
    // Use regex to replace exact class name within quotes or strings
    const regex = new RegExp(`(?<!dark:)\\b${darkClass.replace('/', '\\/')}\\b(?!\\/)`, 'g');
    content = content.replace(regex, combined);
  }
  
  fs.writeFileSync(file, content);
}

console.log("Updated classes!");
