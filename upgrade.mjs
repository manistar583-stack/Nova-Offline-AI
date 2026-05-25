import fs from 'fs';

const files = [
  './src/App.tsx',
  './src/components/ChatMessage.tsx',
  './src/components/MediaViewer.tsx',
  './src/components/CustomAudioPlayer.tsx'
];

const classMap = {
  'bg-nova-dark': 'bg-gray-50 dark:bg-nova-dark',
  'bg-nova-surface': 'bg-white dark:bg-nova-surface',
  'text-gray-200': 'text-gray-800 dark:text-gray-200',
  'text-gray-300': 'text-gray-700 dark:text-gray-300',
  'text-gray-400': 'text-gray-600 dark:text-gray-400',
  'text-gray-500': 'text-gray-500', // doesn't need change usually, it's mid
  'border-gray-700': 'border-gray-200 dark:border-gray-700',
  'border-gray-800': 'border-gray-300 dark:border-gray-800',
  'text-white': 'text-gray-900 dark:text-white',
  'bg-black/50': 'bg-gray-900/50 dark:bg-black/50',
  'hover:text-white': 'hover:text-gray-900 dark:hover:text-white',
  'hover:bg-white/5': 'hover:bg-gray-200 dark:hover:bg-white/5',
};

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  
  for (const [darkClass, combined] of Object.entries(classMap)) {
    const regex = new RegExp(`(?<!dark:)\\b${darkClass.replace('/', '\\/')}\\b(?!/)`, 'g');
    content = content.replace(regex, combined);
  }
  
  // Custom manual fix for text-white in buttons.
  content = content.replace(/bg-nova-accent text-gray-900 dark:text-white/g, 'bg-nova-accent text-white');
  content = content.replace(/text-nova-accent text-gray-900 dark:text-white/g, 'text-nova-accent');
  
  fs.writeFileSync(file, content);
}

console.log("Updated classes successfully");
