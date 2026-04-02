const fs = require('fs');
const path = require('path');

const psFile = path.join(__dirname, '../hack_ps.md');
const outputFile = path.join(__dirname, '../benchmarks/normalized_ps.json');

function normalize() {
  const content = fs.readFileSync(psFile, 'utf8');
  const sections = content.split(/^# /m).filter(Boolean);
  
  const result = [];

  sections.forEach(section => {
    const lines = section.split('\n');
    const category = lines[0].trim();
    
    const psBlocks = section.split(/^## /m).filter(Boolean).slice(1);
    
    psBlocks.forEach((block, idx) => {
      const blockLines = block.split('\n');
      const title = blockLines[0].replace('Problem Statement ', '').replace(/^\d+:\s*/, '').trim();
      
      const backgroundMatch = block.match(/### Background\s+([\s\S]*?)(?=###|$)/i);
      const objectivesMatch = block.match(/### Objectives\s+([\s\S]*?)(?=###|$)/i);
      const featuresMatch = block.match(/### Key Features\s+([\s\S]*?)(?=###|$)/i);
      const brownieMatch = block.match(/### Brownie Points\s+([\s\S]*?)(?=###|$)/i);

      const features = [];
      if (featuresMatch) {
        const featureBlocks = featuresMatch[1].split(/^#### /m).filter(Boolean);
        featureBlocks.forEach(fb => {
          const fbLines = fb.split('\n');
          features.push({
            name: fbLines[0].trim(),
            description: fbLines.slice(1).join('\n').trim()
          });
        });
      }

      result.push({
        id: `${category.toLowerCase().replace(/\//g, '-')}-ps-${idx + 1}`,
        category,
        title,
        background: backgroundMatch ? backgroundMatch[1].trim() : '',
        objectives: objectivesMatch ? objectivesMatch[1].trim() : '',
        features,
        browniePoints: brownieMatch ? brownieMatch[1].trim() : ''
      });
    });
  });

  if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`✅ Normalized ${result.length} problem statements to ${outputFile}`);
}

normalize();
