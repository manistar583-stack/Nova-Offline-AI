import fs from 'fs';

const files = [
  './src/App.tsx',
  './src/components/ChatMessage.tsx',
  './src/components/MediaViewer.tsx',
  './src/components/CustomAudioPlayer.tsx'
];

const classMap: Record<string, string> = {
  'bg-nova-dark': 'bg-gray-50 dark:bg-nova-dark',
  'bg-nova-surface': 'bg-white dark:bg-nova-surface',
  'text-gray-200': 'text-gray-800 dark:text-gray-200',
  'text-gray-300': 'text-gray-700 dark:text-gray-300',
  'text-gray-400': 'text-gray-600 dark:text-gray-400',
  'border-gray-700': 'border-gray-200 dark:border-gray-700',
  'border-gray-800': 'border-gray-200 dark:border-gray-800',
};

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  
  for (const [darkClass, combined] of Object.entries(classMap)) {
    const regex = new RegExp(`(?<!dark:)\\b${darkClass}\\b(?!/)`, 'g');
    content = content.replace(regex, combined);
  }
  
  // also handle standard text-white but only when not inside 'bg-nova-accent'
  // Actually, wait, replacing text-white inside buttons manually is safer, let's just do it by replacing the word boundary if we want.
  // We'll leave `text-white` mostly alone or explicitly replace the ones in App.tsx.
  
  fs.writeFileSync(file, content);
}

console.log("Updated classes!");
