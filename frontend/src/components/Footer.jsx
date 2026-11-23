import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Linkedin, Instagram, Mail, Phone, MapPin, Map as MapIcon } from 'lucide-react';
const LogoImg = '/assets/MapNiti_logo_transparent.png';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const columns = [
    {
      title: 'Company',
      links: [
        { to: '/about', label: 'About MapNiti' },
        { to: '/services', label: 'Services' },
        { to: '/contact', label: 'Contact' },
      ],
    },
    {
      title: 'Product',
      links: [
        { to: '/#features', label: 'Features' },
        { to: '/#services', label: 'What We Offer' },
        { to: '/tool', label: 'MapNiti Tool' },
        { to: '/register', label: 'Get Started' },
      ],
    },
    {
      title: 'Account',
      links: [
        { to: '/login', label: 'Login' },
        { to: '/register', label: 'Create Account' },
      ],
    },
  ];

  return (
    <footer className="bg-gradient-to-br from-[#0080D9] via-[#015298] to-[#061639] text-white mt-auto w-full">
      <div className="container mx-auto px-6 md:px-24 py-16 grid grid-cols-1 md:grid-cols-5 gap-12">
        {/* Brand column */}
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center mb-4">
            {/* navy logo text needs a light backing on the dark footer */}
            <span className="bg-white rounded-xl px-3 py-2 shadow-sm">
              <img src={LogoImg} alt="MapNiti" className="h-9 w-auto object-contain" />
            </span>
          </Link>
          <p className="text-blue-100/70 text-sm leading-relaxed max-w-sm mb-6">
            A full-stack GIS &amp; remote sensing platform for hydrology, disaster risk,
            urban planning, and agriculture analysis, powered by Google Earth Engine.
          </p>
          <div className="flex gap-4">
            <a href="#" aria-label="Facebook" className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-theme-200 hover:text-theme-900 transition-all">
              <Facebook size={16} />
            </a>
            <a href="#" aria-label="LinkedIn" className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-theme-200 hover:text-theme-900 transition-all">
              <Linkedin size={16} />
            </a>
            <a href="#" aria-label="Instagram" className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-theme-200 hover:text-theme-900 transition-all">
              <Instagram size={16} />
            </a>
          </div>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
              {col.title}
            </h4>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-blue-100/80 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact column */}
        <div>
          <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
            Get in Touch
          </h4>
          <ul className="space-y-4 text-sm text-blue-100/80">
            <li className="flex items-start gap-3">
              <Mail size={16} className="mt-0.5 shrink-0" />
              <a href="mailto:info@mapniti.com" className="hover:text-white transition-colors">info@mapniti.com</a>
            </li>
            <li className="flex items-start gap-3">
              <Phone size={16} className="mt-0.5 shrink-0" />
              <a href="tel:+9779824646029" className="hover:text-white transition-colors">+977-9824646029</a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>Kathmandu, Nepal</span>
            </li>
            <li className="flex items-start gap-3">
              <MapIcon size={16} className="mt-0.5 shrink-0" />
              <Link to="/tool" className="hover:text-white transition-colors">Launch the GIS Tool</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-6 md:px-24 py-5 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-[13px] font-medium text-blue-100/70">
            © {currentYear} MapNiti Pvt. Ltd. All rights reserved.
          </p>
          <p className="text-[12px] text-blue-100/50 italic">
            Engineering the future with GIS
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
