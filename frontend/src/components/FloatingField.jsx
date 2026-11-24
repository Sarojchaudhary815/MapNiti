import React, { useState } from "react";

// "Notched outline" floating label: label sits inside the box until the field
// is focused or filled, then floats up to sit directly on the border line
// (with a background patch that cuts a gap into the border), matching the
// common Material-style outlined text field pattern.
// variant="glass" / "soft": translucent field for dark / light gradient backgrounds; the label
// floats to the top inside the box instead of cutting into the border.
const FloatingField = ({ label, name, as = "input", type = "text", rows = 4, value, onChange, variant = "outline", ...props }) => {
  const [focused, setFocused] = useState(false);
  const floated = focused || Boolean(value);
  const Tag = as;

  const fieldClass =
    "w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 outline-none transition-all focus:ring-2 focus:ring-theme-700 focus:border-theme-700 focus:bg-white resize-none";

  // "glass" (on dark) and "soft" (on light gradients): the label floats to the top inside the box
  const glass = variant === "glass" || variant === "soft";
  const glassField = variant === "soft"
    ? "w-full bg-white/80 border border-sky-100 rounded-xl px-4 pt-5 pb-2 text-sm text-slate-800 outline-none transition-all focus:bg-white focus:border-theme-500 focus:ring-2 focus:ring-theme-100 resize-none"
    : "w-full bg-white/10 border border-white/20 rounded-xl px-4 pt-5 pb-2 text-sm text-white outline-none transition-all focus:bg-white/15 focus:border-white/60 focus:ring-2 focus:ring-white/20 resize-none";
  const glassLabel = floated
    ? `absolute left-4 top-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all pointer-events-none ${variant === "soft" ? "text-theme-700" : "text-white/70"}`
    : `absolute left-4 top-3.5 text-sm transition-all pointer-events-none ${variant === "soft" ? "text-slate-400" : "text-white/60"}`;

  const labelClass = glass ? glassLabel : floated
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
    className: glass ? glassField : fieldClass,
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
