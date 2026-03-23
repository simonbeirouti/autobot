"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const personaOptions = ["Founder", "Investor", "Partner", "Journalist", "Other"] as const;
const MARKETING_CONTACT_OPEN_EVENT = "marketing-contact:open";

export function openMarketingContact() {
  window.dispatchEvent(new Event(MARKETING_CONTACT_OPEN_EVENT));
}

export function MarketingContactLink({
  children,
  onClick,
  type = "button",
  ...props
}: {
  children: ReactNode;
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type={type}
      aria-haspopup="dialog"
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        openMarketingContact();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

export function MarketingContactSheet() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener(MARKETING_CONTACT_OPEN_EVENT, handleOpen);

    return () => {
      window.removeEventListener(MARKETING_CONTACT_OPEN_EVENT, handleOpen);
    };
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-black/78 supports-backdrop-filter:backdrop-blur-[2px]"
        className={cn(
          "w-full border-l-0 bg-[#ece9e6] px-5 py-5 text-[#111111] sm:w-[48rem] sm:max-w-[48rem] sm:px-8 sm:py-7",
          "data-[side=right]:w-full data-[side=right]:max-w-none md:data-[side=right]:w-[48rem] md:data-[side=right]:max-w-[48rem]",
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[32rem] space-y-6 pr-4">
              <SheetTitle className="text-[2.3rem] font-medium uppercase leading-[0.9] tracking-[-0.09em] text-[#111111]">
                Talk to AutoBot
              </SheetTitle>
              <SheetDescription className="sr-only">
                Static contact form panel for the AutoBot marketing site.
              </SheetDescription>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-1 shrink-0 text-[#6f6b67] hover:bg-transparent hover:text-[#111111]"
              onClick={() => handleOpenChange(false)}
            >
              <X className="size-5" />
              <span className="sr-only">Close contact form</span>
            </Button>
          </div>

          <form className="mt-8 flex flex-1 flex-col" onSubmit={(event) => event.preventDefault()}>
            <div className="space-y-10">
              <section className="space-y-5">
                <div className="flex items-center gap-2 font-mono text-[0.92rem] uppercase tracking-[0.1em] text-[#111111]">
                  <span>I&apos;m a</span>
                  <span className="text-[#8c8885]">[select one]</span>
                </div>

                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {personaOptions.map((option, index) => {
                    const isSelected = index === 2;

                    return (
                      <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        className={cn(
                          "h-auto min-w-[7.5rem] justify-start border border-transparent px-3 py-3 text-left font-mono text-sm uppercase tracking-[0.06em] text-[#8c8885] hover:bg-transparent",
                          isSelected && "bg-white text-[#f16a38] hover:bg-white hover:text-[#f16a38]",
                        )}
                      >
                        <span className="inline-flex items-center gap-2">
                          {isSelected ? <span className="size-3 rounded-full bg-[#f16a38]" /> : null}
                          {option}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-5">
                <p className="font-mono text-[0.92rem] uppercase tracking-[0.1em] text-[#111111]">
                  About you
                </p>
                <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
                  <ContactInput placeholder="First name" />
                  <ContactInput placeholder="Last name" />
                  <ContactInput placeholder="Email" type="email" />
                  <ContactPhoneInput />
                </div>
              </section>

              <section className="space-y-5">
                <p className="font-mono text-[0.92rem] uppercase tracking-[0.1em] text-[#111111]">
                  Your business
                </p>
                <div className="grid gap-6">
                  <ContactInput placeholder="Business name" />
                  <ContactInput placeholder="Type of business" />
                  <textarea
                    rows={2}
                    placeholder="Message (Optional)"
                    className="min-h-24 w-full resize-none border-0 border-b border-[#beb9b2] bg-transparent px-0 pb-2 pt-0 text-[1.15rem] tracking-[-0.03em] text-[#111111] outline-none placeholder:text-[#8c8885]"
                  />
                </div>
              </section>

              <label className="flex items-start gap-3 pt-1 text-[0.92rem] uppercase tracking-[0.08em] text-[#8c8885]">
                <Checkbox className="mt-0.5 size-5 border-[#7c7773] bg-transparent data-checked:border-[#111111] data-checked:bg-[#111111]" />
                <span>
                  By checking this box I agree to the{" "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 font-inherit text-[#111111] underline-offset-4"
                  >
                    privacy policy
                  </Button>
                </span>
              </label>
            </div>

            <div className="mt-12 pt-2">
              <Button
                type="submit"
                className="h-auto border border-[#111111] bg-transparent px-7 py-4 font-mono text-sm uppercase tracking-[0.08em] text-[#111111] hover:bg-transparent"
              >
                Send message
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContactInput({
  placeholder,
  type = "text",
}: {
  placeholder: string;
  type?: React.ComponentProps<typeof Input>["type"];
}) {
  return (
    <Input
      type={type}
      placeholder={placeholder}
      className="h-auto border-0 border-b border-[#beb9b2] bg-transparent px-0 pb-2 pt-0 text-[1.15rem] tracking-[-0.03em] text-[#111111] placeholder:text-[#8c8885] focus-visible:border-[#111111] focus-visible:ring-0 dark:bg-transparent"
    />
  );
}

function ContactPhoneInput() {
  return (
    <div className="flex items-center gap-3 border-b border-[#beb9b2] pb-2">
      <span className="text-lg">🇺🇸</span>
      <span className="text-sm uppercase tracking-[0.08em] text-[#111111]">+1</span>
      <Input
        type="tel"
        placeholder="Phone"
        className="h-auto border-0 bg-transparent px-0 py-0 text-[1.15rem] tracking-[-0.03em] text-[#111111] placeholder:text-[#8c8885] focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}
