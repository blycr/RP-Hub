const plugin = require('daisyui');

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const rgb = name => 'rgb(var(--' + name + ') / <alpha-value>)';
const scale = (name, role) => Object.fromEntries(steps.map(step => [step, role
  ? 'rgb(var(--' + name + '-' + role + '-' + step + ', var(--' + name + '-' + step + ')) / <alpha-value>)'
  : rgb(name + '-' + step)]));
const colors = {
  gray: scale('gray'), stone: scale('stone'), primary: scale('primary'),
  blue: scale('primary'), red: scale('red'), green: scale('green'),
  emerald: scale('green'), yellow: scale('amber'), amber: scale('amber'), orange: scale('amber'),
};
const textColor = Object.fromEntries(Object.entries(colors).map(([name, value]) => [name, name === 'stone'
  ? value : scale(name === 'blue' ? 'primary' : name === 'emerald' ? 'green' : name === 'yellow' || name === 'orange' ? 'amber' : name, 'text')]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './character/index.html', './novel/index.html', './assets/js/**/*.js'],
  theme: { extend: {
    fontFamily: { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' },
    colors, textColor,
    backgroundColor: { white: rgb('surface'), gray: scale('gray', 'fill'), stone: scale('stone', 'fill') },
    gradientColorStops: { white: rgb('surface'), gray: scale('gray', 'fill'), stone: scale('stone', 'fill') },
    borderColor: { white: rgb('surface-edge') },
    ringColor: { white: rgb('surface-edge') },
    ringOffsetColor: { DEFAULT: 'rgb(var(--gray-50))' },
    animation: { 'fade-in': 'fade-in var(--dur-2) var(--ease-out) both', 'slide-up': 'rise-in var(--dur-3) var(--ease-out) both' },
    transitionTimingFunction: { 'modal-fade': 'var(--ease-out)', spring: 'var(--ease-spring)' },
    boxShadow: { card: 'var(--shadow-1)', soft: 'var(--shadow-1)' },
  } },
  future: { hoverOnlyWhenSupported: true },
  daisyui: { themes: false, logs: false },
  plugins: [plugin],
};
