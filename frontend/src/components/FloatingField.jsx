import React, { useState } from "react";

// "Notched outline" floating label: label sits inside the box until the field
// is focused or filled, then floats up to sit directly on the border line
// (with a background patch that cuts a gap into the border), matching the
// common Material-style outlined text field pattern.
const FloatingField = ({ label, name, as = "input", type = "text", rows = 4, value, onChange, ...props }) => {
  const [focused, setFocused] = useState(false);
  const floated = focused || Boolean(value);
  const Tag = as;

  const fieldClass =
    "w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 outline-none transition-all focus:ring-2 focus:ring-theme-700 focus:border-theme-700 focus:bg-white resize-none";

  const labelClass = floated
    ? `absolute left-4 -top-2.5 px-1.5 bg-white text-xs font-semibold transition-all pointer-events-none ${
        focused ? "text-theme-700" : "text-slate-500"
      }`
    : "absolute left-5 top-4 text-slate-400 text-base transition-all pointer-events-none";

  const commonProps = {
    id: name,
    name,
    value,
    onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    className: fieldClass,
    ...props,
  };

  return (
    <div className="relative">
      {as === "textarea" ? <Tag rows={rows} {...commonProps} /> : <Tag type={type} {...commonProps} />}
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
    </div>
  );
};

export default FloatingField;
