import React from 'react';

export function parseCustomCSS(cssText: string): Record<string, React.CSSProperties> {
  if (!cssText) return {};
  try {
    const lines = cssText.split('\n');
    const styles: any = {};
    let currentSelector: string | null = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('.') && trimmed.includes('{')) {
        currentSelector = trimmed.split('{')[0].trim().replace('.', '');
        styles[currentSelector] = styles[currentSelector] || {};
      } else if (trimmed === '}' || trimmed === '};') {
        currentSelector = null;
      } else if (currentSelector && trimmed.includes(':')) {
        let [prop, val] = trimmed.split(':').map(s => s.trim().replace(';', ''));
        // Convert kebab-case to camelCase
        const camelProp = prop.replace(/-([a-z])/g, g => g[1].toUpperCase());
        
        // Validação: Proibir hacks (tamanho, posição, escala, display)
        const blocked = /width|height|position|top|left|right|bottom|transform|scale|rotate|translate|display|visibility|pointer|z-index|overflow/i;
        if (!blocked.test(camelProp)) {
          styles[currentSelector][camelProp] = val;
        }
      }
    });
    return styles;
  } catch {
    return {};
  }
}
