import React from 'react';

const mainNav = [
  { label: 'Trading', href: '/trading' },
  { label: 'Business', href: '/business' },
  { label: 'Intelligence', href: '/intelligence' },
];

export default function MainNav() {
  return (
    <nav className="main-nav flex gap-6 py-4 px-8 border-b border-gold bg-black/80">
      {mainNav.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="text-xl font-serif text-gold hover:text-white transition-all"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
