import React, { useState } from "react";
import { FaFacebookF, FaLinkedinIn, FaWhatsapp, FaFacebookMessenger, FaInstagram, FaGlobe } from "react-icons/fa";
import { Loader2, CheckCircle2, AlertCircle, Mail, Phone } from "lucide-react";
import { sendContact } from "../api/websiteApi";
import FloatingField from "../components/FloatingField";
import ContourLines from "../components/ContourLines";

const founder = {
  name: "Saroj Chaudhary",
  designation: "Developer",
  photo: "/assets/team/Saroj-cutout.png",
  email: "info@chaudharysaroj.com.np",
  phone: "+9779824646029",
  phoneDisplay: "+977-9824646029",
  website: "https://chaudharysaroj.com.np",
  linkedin: "#",
};

const MapNitiFullContact = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await sendContact(form);
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Could not send your message. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="font-sans text-slate-900 bg-theme-50/15 min-h-screen">

      {/* --- 1. INTRO & FOUNDER --- */}
      <section className="relative overflow-hidden py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <ContourLines className="absolute inset-y-0 left-0 w-1/2 h-full text-theme-200 pointer-events-none" />
        <div className="relative z-10 text-left">
          <h1 className="text-4xl font-black mb-6 border-l-8 border-theme-700 pl-6 uppercase">Contact MapNiti</h1>
          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            MapNiti is a pioneer in location intelligence in Nepal. We specialize in converting
            raw geographical data into strategic insights for urban planning.
          </p>
          <a href="#contact-form" className="inline-block bg-theme-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-theme-900 transition-all">
            Get In Touch
          </a>
        </div>

        <div className="relative z-10 flex items-end gap-6">
          <div className="w-56 shrink-0">
            <p className="text-theme-700 font-black uppercase tracking-widest text-xs mb-1">Developed By</p>
            <h3 className="text-2xl font-black text-slate-800 whitespace-nowrap mb-4">{founder.name}</h3>
            <div className="space-y-2 mb-4">
              <a href={`mailto:${founder.email}`} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-theme-900 transition-colors">
                <Mail size={15} className="text-theme-700 shrink-0" /> {founder.email}
              </a>
              <a href={`tel:${founder.phone}`} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-theme-900 transition-colors">
                <Phone size={15} className="text-theme-700 shrink-0" /> {founder.phoneDisplay}
              </a>
            </div>
            <div className="flex gap-3">
              <a href={founder.website} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-theme-700 text-white flex items-center justify-center hover:bg-theme-900 transition-colors" title="Website">
                <FaGlobe size={14} />
              </a>
              <a href={founder.linkedin} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-theme-800 text-white flex items-center justify-center hover:bg-theme-900 transition-colors" title="LinkedIn">
                <FaLinkedinIn size={14} />
              </a>
            </div>
          </div>
          <img
            src={founder.photo}
            alt={founder.name}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="flex-1 h-80 md:h-96 w-full object-contain object-left-bottom select-none"
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
              maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
              WebkitUserDrag: "none",
            }}
          />
        </div>
      </section>

      {/* --- 2. CONTACT FORM --- */}
      <section id="contact-form" className="py-20 bg-theme-50/15 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black mb-3 text-center uppercase tracking-tight">Send Us a Message</h2>
          <p className="text-slate-500 text-center mb-12">
            Tell us what you did not like, or what help you need. We read every message.
          </p>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10">
            {status === "success" ? (
              <div className="flex flex-col items-center text-center py-10">
                <CheckCircle2 className="text-green-500 mb-4" size={48} />
                <h3 className="text-xl font-black text-slate-800 mb-2">Message Sent</h3>
                <p className="text-slate-500 text-sm">Thank you for reaching out. We will get back to you soon.</p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-6 text-theme-700 font-bold text-sm hover:text-theme-900 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="space-y-4 text-left" onSubmit={handleSubmit}>
                {status === "error" && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}
                <FloatingField label="Full Name" name="name" value={form.name} onChange={handleChange} required />
                <FloatingField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} required />
                <FloatingField label="What did not work for you, or how can we help?" name="message" as="textarea" rows={7} value={form.message} onChange={handleChange} required />
                <button
                  disabled={status === "loading"}
                  className="w-full flex items-center justify-center gap-2 bg-theme-700 text-white font-black py-5 rounded-2xl hover:bg-theme-900 shadow-xl transition-all uppercase tracking-widest disabled:opacity-50"
                >
                  {status === "loading" && <Loader2 size={18} className="animate-spin" />}
                  {status === "loading" ? "Sending..." : "Submit"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* --- 3. FINAL CONTACT AREA WITH LOGO --- */}
      <div className="bg-theme-50/20 py-16 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">

            <div className="text-left min-w-[200px]">
              <div className="h-12 mb-2 flex items-center">
                <img
                  src="/assets/MapNiti_logo_transparent.png"
                  alt="MapNiti"
                  className="h-full w-auto object-contain"
                  onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}
                />
                <span className="text-3xl font-black text-theme-700 tracking-tighter hidden">MAPNITI</span>
              </div>
              <p className="text-sm font-bold text-slate-500">Dhangadhi Chauraha, Kailali, Nepal</p>
            </div>

            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Email Us</p>
              <div className="flex flex-col gap-1">
                <a href="mailto:info@mapniti.com" className="text-base font-bold text-slate-700 hover:text-theme-900 transition-colors">info@mapniti.com</a>
                <a href="mailto:mapniti@gmail.com" className="text-base font-bold text-slate-700 hover:text-theme-900 transition-colors">mapniti@gmail.com</a>
              </div>
            </div>

            <div className="text-left">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Contact No.</p>
              <div className="flex flex-col gap-1">
                <a href="tel:+9779824646029" className="text-base font-bold text-slate-700 hover:text-theme-900 transition-colors">+977-9824646029</a>
                <a href="tel:+9779804664959" className="text-base font-bold text-slate-700 hover:text-theme-900 transition-colors">+977-9804664959</a>
              </div>
            </div>

            <div className="flex flex-col items-end gap-4 ml-auto">
              <div className="flex items-center gap-4">
                <span className="font-black text-slate-800 text-sm uppercase tracking-tighter">Chat with us:</span>
                <div className="flex gap-2">
                  <a href="#" className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:scale-110 transition-all shadow-md"><FaWhatsapp className="text-xl" /></a>
                  <a href="#" className="w-10 h-10 bg-[#0084FF] rounded-full flex items-center justify-center text-white hover:scale-110 transition-all shadow-md"><FaFacebookMessenger className="text-xl" /></a>
                </div>
              </div>
              <div className="flex gap-6 pr-1">
                <a href="#" className="text-slate-400 hover:text-theme-900 transition-colors text-xl"><FaFacebookF /></a>
                <a href="#" className="text-slate-400 hover:text-theme-900 transition-colors text-xl"><FaLinkedinIn /></a>
                <a href="#" className="text-slate-400 hover:text-pink-600 transition-colors text-xl"><FaInstagram /></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapNitiFullContact;
