const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
    content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            backgroundImage: {
                'grid-pattern': "linear-gradient(to bottom, theme('colors.neutral.950 / 0%'), theme('colors.neutral.950 / 100%')), url('/images/noise.png')"
            },
            colors: {
                neutral: colors.neutral
            },
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans]
            }
        }
    },
    daisyui: {
        themes: [
            {
                lofi: {
                    ...require('daisyui/src/theming/themes')['lofi'],
                    primary: '#2bdcd2',
                    'primary-content': '#171717',
                    secondary: '#016968',
                    info: '#2bdcd2',
                    'info-content': '#171717',
                }
            }
        ]
    },
    // Add a plugin for custom utilities
    plugins: [
        require('daisyui'),
        function({ addComponents }) {
            addComponents({
                '.bg-white': {
                    '& *': {
                        '--tw-text-opacity': '1',
                        'color': 'rgb(75 85 99 / var(--tw-text-opacity))', // text-gray-600
                    },
                    '& h1, & h2, & h3, & h4, & h5, & h6, & .font-bold, & .font-semibold': {
                        '--tw-text-opacity': '1',
                        'color': 'rgb(17 24 39 / var(--tw-text-opacity))', // text-gray-900
                    },
                    '& a': {
                        '--tw-text-opacity': '1',
                        'color': 'rgb(59 130 246 / var(--tw-text-opacity))', // text-blue-500
                        '&:hover': {
                            '--tw-text-opacity': '0.7',
                        }
                    }
                }
            });
        }
    ]
};