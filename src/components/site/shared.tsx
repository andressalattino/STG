import { Facebook, Instagram, Mail, MessageCircle } from "lucide-react";
import type React from "react";
import { commentsEmail, whatsappUrl } from "@/data/site";
export function PageHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-black leading-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 leading-8 text-muted">{text}</p>
    </div>
  );
}

export function Metric({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="surface-card p-5 transition hover:-translate-y-0.5">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stg-yellow text-ink">
        {icon}
      </div>
      <h3 className="mt-4 font-black text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Field wraps its input, select or textarea child.
    <label className="grid gap-2 text-sm font-bold text-foreground">
      {label}
      {children}
    </label>
  );
}

export function SocialLinks() {
  const links = [
    {
      label: "WhatsApp",
      href: whatsappUrl,
      icon: <MessageCircle size={18} />,
      className: "bg-[#25d366] text-white hover:bg-[#20bd5a]",
    },
    {
      label: "Mail",
      href: `mailto:${commentsEmail}`,
      icon: <Mail size={18} />,
      className:
        "border border-line bg-surface text-foreground hover:bg-subtle",
    },
    {
      label: "Instagram",
      href: "https://www.instagram.com/stgturismo/",
      icon: <Instagram size={18} />,
      className:
        "bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white",
    },
    {
      label: "Facebook",
      href: "https://www.facebook.com/viajesSTG/",
      icon: <Facebook size={18} />,
      className: "bg-[#1877f2] text-white hover:bg-[#0f68dc]",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noreferrer" : undefined}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${link.className}`}
        >
          {link.icon}
          {link.label}
        </a>
      ))}
    </div>
  );
}
