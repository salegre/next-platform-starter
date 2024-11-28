import React from 'react';

const countryFlags = {
  US: '🇺🇸',
  PE: '🇵🇪',
  Global: '🌎',
  // Add more country codes as needed
};

export function Country({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center">
      {countryFlags[code] || ''}
    </span>
  );
}